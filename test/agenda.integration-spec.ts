import { randomUUID } from 'node:crypto';
import { Temporal } from '@js-temporal/polyfill';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { configureApp } from '../src/common/configure-app.js';
import { withEmpresaLock } from '../src/common/empresa-transaction.js';

describe('Agenda concorrente com MySQL real', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const empresas: number[] = [];
  const pedidos: Array<{
    clienteId: number;
    profissionalId: number;
    servicoIds: number[];
    inicio: string;
  }> = [];

  beforeEach(async () => {
    empresas.length = 0;
    pedidos.length = 0;
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app, ['http://localhost:5173']);
    await app.init();
    prisma = app.get(PrismaService);
    const dia = Temporal.Now.zonedDateTimeISO('America/Sao_Paulo')
      .toPlainDate()
      .add({ days: 1 });
    const inicio = dia
      .toPlainDateTime({ hour: 9 })
      .toZonedDateTime('America/Sao_Paulo')
      .toInstant()
      .toString();
    for (const nome of ['Centro', 'Bairro']) {
      const empresa = await prisma.empresa.create({
        data: {
          nome: 'Concorrência ' + nome,
          diasFuncionamento: [1, 2, 3, 4, 5, 6, 7],
          cnpj:
            randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase() + '00',
        },
      });
      empresas.push(empresa.id);
      const cliente = await prisma.cliente.create({
        data: {
          empresaId: empresa.id,
          nome: 'Cliente',
          telefone: '11999990001',
        },
      });
      const profissional = await prisma.profissional.create({
        data: { empresaId: empresa.id, nome: 'Barbeiro' },
      });
      const servico = await prisma.servico.create({
        data: {
          empresaId: empresa.id,
          nome: 'Corte',
          preco: '40.10',
          duracaoMin: 30,
        },
      });
      pedidos.push({
        clienteId: cliente.id,
        profissionalId: profissional.id,
        servicoIds: [servico.id],
        inicio,
      });
    }
  });

  afterEach(async () => {
    try {
      if (prisma && empresas.length) {
        const where = { empresaId: { in: empresas } };
        await prisma.agendamentoServico.deleteMany({ where });
        await prisma.agendamento.deleteMany({ where });
        await prisma.servico.deleteMany({ where });
        await prisma.profissional.deleteMany({ where });
        await prisma.cliente.deleteMany({ where });
        await prisma.empresa.deleteMany({ where: { id: { in: empresas } } });
      }
    } finally {
      await app?.close();
    }
  });

  function reservar(index: number, chave: string) {
    return request(app.getHttpServer())
      .post('/agendamentos')
      .set('x-empresa-id', String(empresas[index]))
      .set('Idempotency-Key', chave)
      .send(pedidos[index]);
  }

  it('confirma apenas uma de duas reservas simultâneas sobrepostas', async () => {
    const responses = await Promise.all([
      reservar(0, randomUUID()),
      reservar(0, randomUUID()),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(
      await prisma.agendamento.count({ where: { empresaId: empresas[0] } }),
    ).toBe(1);
    expect(
      await prisma.agendamentoServico.count({
        where: { empresaId: empresas[0] },
      }),
    ).toBe(1);
  });

  it('duas requisições simultâneas com a mesma chave recuperam a mesma reserva', async () => {
    const chave = randomUUID();
    const responses = await Promise.all([
      reservar(0, chave),
      reservar(0, chave),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 201]);
    expect(responses[0].body.id).toBe(responses[1].body.id);
    expect(
      await prisma.agendamento.count({ where: { empresaId: empresas[0] } }),
    ).toBe(1);
  });

  it('mantém a chave isolada por empresa e não permite consultar a de outra empresa', async () => {
    const chave = randomUUID();
    const first = await reservar(0, chave).expect(201);
    await request(app.getHttpServer())
      .get('/agendamentos/operacoes/' + chave)
      .set('x-empresa-id', String(empresas[1]))
      .expect(404);
    const second = await reservar(1, chave).expect(201);
    expect(second.body.id).not.toBe(first.body.id);
    await request(app.getHttpServer())
      .patch('/agendamentos/' + first.body.id + '/status')
      .set('x-empresa-id', String(empresas[1]))
      .send({ status: 'CANCELADO' })
      .expect(404);
  });

  it('faz rollback de reserva e snapshots se a transação falhar', async () => {
    const chave = randomUUID();
    await expect(
      withEmpresaLock(prisma, empresas[0], async (tx) => {
        const inicio = new Date(pedidos[0].inicio);
        await tx.agendamento.create({
          data: {
            empresaId: empresas[0],
            clienteId: pedidos[0].clienteId,
            profissionalId: pedidos[0].profissionalId,
            inicio,
            fim: new Date(inicio.getTime() + 1800000),
            chaveOperacao: chave,
            hashPedido: 'a'.repeat(64),
            servicos: {
              create: [
                {
                  servicoId: pedidos[0].servicoIds[0],
                  precoCobrado: '40.10',
                  nomeContratado: 'Corte',
                  duracaoContratadaMin: 30,
                },
              ],
            },
          },
        });
        throw new Error('Falha simulada antes de confirmar');
      }),
    ).rejects.toThrow('Falha simulada');
    expect(
      await prisma.agendamento.count({ where: { empresaId: empresas[0] } }),
    ).toBe(0);
    expect(
      await prisma.agendamentoServico.count({
        where: { empresaId: empresas[0] },
      }),
    ).toBe(0);
    await reservar(0, chave).expect(201);
  });

  it('cancelar libera o horário sem remover histórico e sem permitir reabertura', async () => {
    const created = await reservar(0, randomUUID()).expect(201);
    const path = '/agendamentos/' + created.body.id + '/status';
    await request(app.getHttpServer())
      .patch(path)
      .set('x-empresa-id', String(empresas[0]))
      .send({ status: 'CANCELADO' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(path)
      .set('x-empresa-id', String(empresas[0]))
      .send({ status: 'CANCELADO' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(path)
      .set('x-empresa-id', String(empresas[0]))
      .send({ status: 'CONCLUIDO' })
      .expect(409);
    await reservar(0, randomUUID()).expect(201);
    expect(
      await prisma.agendamento.count({ where: { empresaId: empresas[0] } }),
    ).toBe(2);
  });

  it('duas finalizações divergentes não sobrescrevem uma à outra', async () => {
    const created = await reservar(0, randomUUID()).expect(201);
    const inicio = new Date(Date.now() - 3600000);
    await prisma.agendamento.update({
      where: { id: created.body.id },
      data: { inicio, fim: new Date(inicio.getTime() + 1800000) },
    });
    const responses = await Promise.all(
      ['CONCLUIDO', 'FALTOU'].map((status) =>
        request(app.getHttpServer())
          .patch('/agendamentos/' + created.body.id + '/status')
          .set('x-empresa-id', String(empresas[0]))
          .send({ status }),
      ),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    const final = await prisma.agendamento.findUniqueOrThrow({
      where: { id: created.body.id },
    });
    expect(['CONCLUIDO', 'FALTOU']).toContain(final.status);
  });

  it('coordena desativação do profissional com reserva concorrente', async () => {
    const [booking, change] = await Promise.all([
      reservar(0, randomUUID()),
      request(app.getHttpServer())
        .patch('/profissionais/' + pedidos[0].profissionalId)
        .set('x-empresa-id', String(empresas[0]))
        .send({ ativo: false }),
    ]);
    expect(change.status).toBe(200);
    expect([201, 404]).toContain(booking.status);
    expect(
      await prisma.agendamento.count({ where: { empresaId: empresas[0] } }),
    ).toBe(booking.status === 201 ? 1 : 0);
    expect(
      (
        await prisma.profissional.findUniqueOrThrow({
          where: { id: pedidos[0].profissionalId },
        })
      ).ativo,
    ).toBe(false);
  });

  it('coordena alteração de preço com o snapshot da reserva', async () => {
    const [booking, change] = await Promise.all([
      reservar(0, randomUUID()),
      request(app.getHttpServer())
        .patch('/servicos/' + pedidos[0].servicoIds[0])
        .set('x-empresa-id', String(empresas[0]))
        .send({ preco: '99.90' }),
    ]);
    expect(booking.status).toBe(201);
    expect(change.status).toBe(200);
    const item = await prisma.agendamentoServico.findFirstOrThrow({
      where: { empresaId: empresas[0] },
    });
    expect(['40.10', '99.90']).toContain(item.precoCobrado.toFixed(2));
    expect(item.precoCobrado.toFixed(2)).toBe(booking.body.total);
  });

  it('coordena a desativação da empresa com a confirmação', async () => {
    const [booking, change] = await Promise.all([
      reservar(0, randomUUID()),
      request(app.getHttpServer())
        .patch('/empresas/' + empresas[0])
        .send({ ativa: false }),
    ]);
    expect(change.status).toBe(200);
    expect([201, 400]).toContain(booking.status);
    expect(
      await prisma.agendamento.count({ where: { empresaId: empresas[0] } }),
    ).toBe(booking.status === 201 ? 1 : 0);
  });
  it('rejeita pedido divergente com a mesma chave e preserva o original consultável', async () => {
    const key = randomUUID();
    const original = await reservar(0, key).expect(201);
    const changed = {
      ...pedidos[0],
      inicio: new Date(
        new Date(pedidos[0].inicio).getTime() + 15 * 60000,
      ).toISOString(),
    };
    const response = await request(app.getHttpServer())
      .post('/agendamentos')
      .set('x-empresa-id', String(empresas[0]))
      .set('Idempotency-Key', key)
      .send(changed)
      .expect(409);
    expect(response.body.code).toBe('OPERACAO_DIVERGENTE');
    const read = await request(app.getHttpServer())
      .get('/agendamentos/operacoes/' + key)
      .set('x-empresa-id', String(empresas[0]))
      .expect(200);
    expect(read.body.id).toBe(original.body.id);
    expect(
      await prisma.agendamento.count({ where: { empresaId: empresas[0] } }),
    ).toBe(1);
  });
  it('aceita duas reservas adjacentes simultâneas sem sobreposição', async () => {
    const later = {
      ...pedidos[0],
      inicio: new Date(
        new Date(pedidos[0].inicio).getTime() + 30 * 60000,
      ).toISOString(),
    };
    const responses = await Promise.all([
      reservar(0, randomUUID()),
      request(app.getHttpServer())
        .post('/agendamentos')
        .set('x-empresa-id', String(empresas[0]))
        .set('Idempotency-Key', randomUUID())
        .send(later),
    ]);
    expect(responses.map((r) => r.status)).toEqual([201, 201]);
    const rows = await prisma.agendamento.findMany({
      where: { empresaId: empresas[0] },
      orderBy: { inicio: 'asc' },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0].fim).toEqual(rows[1].inicio);
  });
  it('reserva com vários itens disputa o intervalo completo e não deixa snapshots do pedido recusado', async () => {
    const extra = await prisma.servico.create({
      data: {
        empresaId: empresas[0],
        nome: 'Barba',
        preco: '15.05',
        duracaoMin: 20,
      },
    });
    const multi = {
      ...pedidos[0],
      servicoIds: [...pedidos[0].servicoIds, extra.id],
    };
    const overlap = {
      ...pedidos[0],
      inicio: new Date(
        new Date(pedidos[0].inicio).getTime() + 30 * 60000,
      ).toISOString(),
    };
    const send = (body: typeof multi) =>
      request(app.getHttpServer())
        .post('/agendamentos')
        .set('x-empresa-id', String(empresas[0]))
        .set('Idempotency-Key', randomUUID())
        .send(body);
    const responses = await Promise.all([send(multi), send(overlap)]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    const winner = responses.find((r) => r.status === 201)!.body;
    expect(
      await prisma.agendamento.count({ where: { empresaId: empresas[0] } }),
    ).toBe(1);
    expect(
      await prisma.agendamentoServico.count({
        where: { empresaId: empresas[0] },
      }),
    ).toBe(winner.servicos.length);
    if (winner.servicos.length === 2) {
      expect(winner.total).toBe('55.15');
      expect(
        new Date(winner.fim).getTime() - new Date(winner.inicio).getTime(),
      ).toBe(50 * 60000);
    }
  });
});
