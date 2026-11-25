import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/common/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Cadastros e histórico com MySQL real', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const empresas: number[] = [];
  let cliente: number;
  let outroCliente: number;
  let profissional: number;
  let outroProfissional: number;
  let servico: number;
  let outroServico: number;
  let agendamento: number;

  beforeEach(async () => {
    empresas.length = 0;
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app, ['http://localhost:5173']);
    await app.init();
    prisma = app.get(PrismaService);

    for (const nome of ['Centro', 'Bairro', 'Inativa']) {
      const empresa = await prisma.empresa.create({
        data: {
          nome: 'Teste ' + nome,
          ativa: nome !== 'Inativa',
          cnpj:
            randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase() + '00',
        },
      });
      empresas.push(empresa.id);
    }
    const clientes = [];
    const profissionais = [];
    const servicos = [];
    for (const [index, nome] of ['Centro', 'Bairro'].entries()) {
      clientes.push(
        await prisma.cliente.create({
          data: {
            nome: 'Cliente ' + nome,
            telefone: '11999990001',
            empresaId: empresas[index],
          },
        }),
      );
      profissionais.push(
        await prisma.profissional.create({
          data: { nome: 'Profissional ' + nome, empresaId: empresas[index] },
        }),
      );
      servicos.push(
        await prisma.servico.create({
          data: {
            nome: 'Corte',
            preco: '40.10',
            duracaoMin: 30,
            empresaId: empresas[index],
          },
        }),
      );
    }
    cliente = clientes[0].id;
    outroCliente = clientes[1].id;
    profissional = profissionais[0].id;
    outroProfissional = profissionais[1].id;
    servico = servicos[0].id;
    outroServico = servicos[1].id;
    const inicio = new Date(Date.now() - 3600000);
    const reserva = await prisma.agendamento.create({
      data: {
        empresaId: empresas[0],
        clienteId: cliente,
        profissionalId: profissional,
        inicio,
        fim: new Date(inicio.getTime() + 1800000),
        status: 'CONCLUIDO',
        servicos: {
          create: [
            {
              servicoId: servico,
              nomeContratado: 'Corte',
              duracaoContratadaMin: 30,
              precoCobrado: '40.10',
            },
          ],
        },
      },
    });
    agendamento = reserva.id;
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

  it('restringe busca e contagem à empresa', async () => {
    const response = await request(app.getHttpServer())
      .get('/clientes?busca=Bair&page=1&pageSize=1')
      .set('x-empresa-id', String(empresas[1]))
      .expect(200);
    expect(response.body).toMatchObject({ total: 1, page: 1, pageSize: 1 });
    expect(response.body.items.map((item: { id: number }) => item.id)).toEqual([
      outroCliente,
    ]);
    const outra = await request(app.getHttpServer())
      .get('/clientes?busca=Bair')
      .set('x-empresa-id', String(empresas[0]))
      .expect(200);
    expect(outra.body.total).toBe(0);
  });

  it('busca por telefone parcial formatado', async () => {
    const response = await request(app.getHttpServer())
      .get('/clientes')
      .query({ busca: '(11) 99999' })
      .set('x-empresa-id', String(empresas[0]))
      .expect(200);
    expect(response.body.items.map((item: { id: number }) => item.id)).toEqual([
      cliente,
    ]);
  });

  it('permite telefone repetido entre empresas e bloqueia na mesma empresa', async () => {
    for (const empresa of empresas.slice(0, 2)) {
      await request(app.getHttpServer())
        .post('/clientes')
        .set('x-empresa-id', String(empresa))
        .send({ nome: 'Novo', telefone: '(11) 99999-0003' })
        .expect(201);
    }
    await request(app.getHttpServer())
      .post('/clientes')
      .set('x-empresa-id', String(empresas[0]))
      .send({ nome: 'Duplicado', telefone: '11999990003' })
      .expect(409);
  });

  it('impede colisão na edição e preserva o telefone original', async () => {
    await prisma.cliente.create({
      data: {
        nome: 'Outro',
        telefone: '11999990002',
        empresaId: empresas[0],
      },
    });
    const response = await request(app.getHttpServer())
      .patch('/clientes/' + cliente)
      .set('x-empresa-id', String(empresas[0]))
      .send({ telefone: '+55 (11) 99999-0002' })
      .expect(409);
    expect(response.body.code).toBe('TELEFONE_DUPLICADO');
    expect(
      (await prisma.cliente.findUniqueOrThrow({ where: { id: cliente } }))
        .telefone,
    ).toBe('11999990001');
  });

  it('rejeita cadastro em empresa inativa', async () => {
    await request(app.getHttpServer())
      .post('/clientes')
      .set('x-empresa-id', String(empresas[2]))
      .send({ nome: 'Bloqueado', telefone: '11999990003' })
      .expect(400);
    expect(
      await prisma.cliente.count({ where: { empresaId: empresas[2] } }),
    ).toBe(0);
  });

  it('não lê, altera nem exclui cliente de outra empresa', async () => {
    const path = '/clientes/' + outroCliente;
    await request(app.getHttpServer())
      .get(path)
      .set('x-empresa-id', String(empresas[0]))
      .expect(404);
    await request(app.getHttpServer())
      .patch(path)
      .set('x-empresa-id', String(empresas[0]))
      .send({ nome: 'Indevido' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(path)
      .set('x-empresa-id', String(empresas[0]))
      .expect(404);
    expect(
      (await prisma.cliente.findUniqueOrThrow({ where: { id: outroCliente } }))
        .nome,
    ).toBe('Cliente Bairro');
  });

  it('preserva nome, preço e duração contratados após alterar o catálogo', async () => {
    const response = await request(app.getHttpServer())
      .patch('/servicos/' + servico)
      .set('x-empresa-id', String(empresas[0]))
      .send({
        nome: 'Novo corte',
        preco: '99.90',
        duracaoMin: 60,
        ativo: false,
      })
      .expect(200);
    expect(response.body.preco).toBe('99.90');
    const item = await prisma.agendamentoServico.findUniqueOrThrow({
      where: {
        agendamentoId_servicoId: {
          agendamentoId: agendamento,
          servicoId: servico,
        },
      },
    });
    expect(item.nomeContratado).toBe('Corte');
    expect(item.duracaoContratadaMin).toBe(30);
    expect(item.precoCobrado.toFixed(2)).toBe('40.10');
    const list = await request(app.getHttpServer())
      .get('/servicos?ativo=false')
      .set('x-empresa-id', String(empresas[0]))
      .expect(200);
    expect(list.body.items.map((entry: { id: number }) => entry.id)).toEqual([
      servico,
    ]);
  });

  it('desativa profissional sem apagar o histórico e impede novas reservas', async () => {
    await request(app.getHttpServer())
      .patch('/profissionais/' + profissional)
      .set('x-empresa-id', String(empresas[0]))
      .send({ ativo: false })
      .expect(200);
    expect(
      await prisma.agendamento.count({
        where: { profissionalId: profissional },
      }),
    ).toBe(1);
    await request(app.getHttpServer())
      .post('/agendamentos')
      .set('x-empresa-id', String(empresas[0]))
      .send({
        clienteId: cliente,
        profissionalId: profissional,
        servicoIds: [servico],
        inicio: new Date(Date.now() + 86400000).toISOString(),
      })
      .expect(404);
  });

  it('bloqueia exclusão física de registros com histórico', async () => {
    for (const [resource, id] of [
      ['clientes', cliente],
      ['profissionais', profissional],
      ['servicos', servico],
    ]) {
      await request(app.getHttpServer())
        .delete('/' + resource + '/' + id)
        .set('x-empresa-id', String(empresas[0]))
        .expect(409);
    }
    expect(await prisma.agendamento.count({ where: { id: agendamento } })).toBe(
      1,
    );
  });

  it('o banco rejeita cliente de outra empresa mesmo sem passar pela API', async () => {
    const inicio = new Date(Date.now() + 86400000);
    await expect(
      prisma.agendamento.create({
        data: {
          empresaId: empresas[0],
          clienteId: outroCliente,
          profissionalId: profissional,
          inicio,
          fim: new Date(inicio.getTime() + 1800000),
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('o banco rejeita profissional de outra empresa', async () => {
    const inicio = new Date(Date.now() + 86400000);
    await expect(
      prisma.agendamento.create({
        data: {
          empresaId: empresas[0],
          clienteId: cliente,
          profissionalId: outroProfissional,
          inicio,
          fim: new Date(inicio.getTime() + 1800000),
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('o banco rejeita serviço de outra empresa na reserva', async () => {
    await expect(
      prisma.agendamentoServico.create({
        data: {
          empresaId: empresas[0],
          agendamentoId: agendamento,
          servicoId: outroServico,
          nomeContratado: 'Outro corte',
          duracaoContratadaMin: 30,
          precoCobrado: '40.10',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });
});
