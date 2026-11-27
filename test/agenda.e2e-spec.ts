import type { INestApplication } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { Prisma } from '../src/generated/prisma/client.js';
import { configureApp } from '../src/common/configure-app.js';
import {
  agendaDouble,
  AGORA,
  CHAVE,
  OUTRA_CHAVE,
  reservaFixture,
} from './helpers/agenda-double.js';

describe('Agenda HTTP sem banco', () => {
  let app: INestApplication;
  let db: ReturnType<typeof agendaDouble>;
  const pedido = {
    clienteId: 11,
    profissionalId: 7,
    servicoIds: [9],
    inicio: '2030-01-07T09:00:00-03:00',
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(AGORA);
    db = agendaDouble();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(db)
      .compile();
    app = module.createNestApplication();
    configureApp(app, ['http://localhost:5173']);
    await app.init();
  });
  afterEach(async () => {
    await app?.close();
    vi.useRealTimers();
  });

  it('oferece horários com fuso, duração e preço sem depender do fuso do processo', async () => {
    const response = await request(app.getHttpServer())
      .get('/agendamentos/disponibilidade')
      .query({ data: '2030-01-07', profissionalId: 7, servicoIds: '9' })
      .set('x-empresa-id', '1')
      .expect(200);
    expect(response.body).toMatchObject({
      fusoHorario: 'America/Sao_Paulo',
      duracaoMin: 30,
      total: '40.00',
    });
    expect(response.body.horarios[0]).toEqual({
      inicio: '2030-01-07T12:00:00.000Z',
      fim: '2030-01-07T12:30:00.000Z',
    });
  });

  it('soma preços decimais de vários serviços sem erro de ponto flutuante', async () => {
    db.servico.findMany.mockResolvedValue([
      {
        id: 9,
        empresaId: 1,
        ativo: true,
        nome: 'A',
        preco: new Prisma.Decimal('0.10'),
        duracaoMin: 5,
      },
      {
        id: 10,
        empresaId: 1,
        ativo: true,
        nome: 'B',
        preco: new Prisma.Decimal('0.20'),
        duracaoMin: 5,
      },
    ]);
    const response = await request(app.getHttpServer())
      .get('/agendamentos/disponibilidade')
      .query({ data: '2030-01-07', profissionalId: 7, servicoIds: '9,10' })
      .set('x-empresa-id', '1')
      .expect(200);
    expect(response.body).toMatchObject({ duracaoMin: 10, total: '0.30' });
  });

  it.each([
    { data: '2030-02-30', profissionalId: 7, servicoIds: '9' },
    { data: '2030-01-07', profissionalId: 0, servicoIds: '9' },
    { data: '2030-01-07', profissionalId: 7, servicoIds: '9,9' },
    { data: '2030-01-07', profissionalId: 7, servicoIds: '9,abc' },
  ])('rejeita consulta inválida de disponibilidade %s', async (query) => {
    await request(app.getHttpServer())
      .get('/agendamentos/disponibilidade')
      .query(query)
      .set('x-empresa-id', '1')
      .expect(400);
  });

  it('retorna lista vazia em dia fechado', async () => {
    const response = await request(app.getHttpServer())
      .get('/agendamentos/disponibilidade')
      .query({ data: '2030-01-13', profissionalId: 7, servicoIds: '9' })
      .set('x-empresa-id', '1')
      .expect(200);
    expect(response.body.horarios).toEqual([]);
  });

  it('exige chave de operação e DTO válido antes da reserva', async () => {
    await request(app.getHttpServer())
      .post('/agendamentos')
      .set('x-empresa-id', '1')
      .send(pedido)
      .expect(400);
    await request(app.getHttpServer())
      .post('/agendamentos')
      .set('x-empresa-id', '1')
      .set('Idempotency-Key', CHAVE)
      .send({ ...pedido, inicio: '2030-01-07T09:00:00' })
      .expect(400);
    expect(db.agendamento.create).not.toHaveBeenCalled();
  });

  it('cria, consulta confirmação e recupera o mesmo pedido com status 200', async () => {
    const created = await request(app.getHttpServer())
      .post('/agendamentos')
      .set('x-empresa-id', '1')
      .set('Idempotency-Key', CHAVE)
      .send(pedido)
      .expect(201);
    const replay = await request(app.getHttpServer())
      .post('/agendamentos')
      .set('x-empresa-id', '1')
      .set('Idempotency-Key', CHAVE)
      .send(pedido)
      .expect(200);
    expect(replay.body.id).toBe(created.body.id);
    expect(replay.body).not.toHaveProperty('hashPedido');
    await request(app.getHttpServer())
      .get('/agendamentos/operacoes/' + CHAVE)
      .set('x-empresa-id', '1')
      .expect(200);
    await request(app.getHttpServer())
      .get('/agendamentos/' + created.body.id)
      .set('x-empresa-id', '2')
      .expect(404);
    await request(app.getHttpServer())
      .get('/agendamentos/operacoes/' + CHAVE)
      .set('x-empresa-id', '2')
      .expect(404);
  });

  it('recusa conflito de horário e reutilização divergente da chave', async () => {
    await request(app.getHttpServer())
      .post('/agendamentos')
      .set('x-empresa-id', '1')
      .set('Idempotency-Key', CHAVE)
      .send(pedido)
      .expect(201);
    const conflito = await request(app.getHttpServer())
      .post('/agendamentos')
      .set('x-empresa-id', '1')
      .set('Idempotency-Key', OUTRA_CHAVE)
      .send(pedido)
      .expect(409);
    expect(conflito.body.code).toBe('HORARIO_OCUPADO');
    const divergente = await request(app.getHttpServer())
      .post('/agendamentos')
      .set('x-empresa-id', '1')
      .set('Idempotency-Key', CHAVE)
      .send({ ...pedido, inicio: '2030-01-07T10:00:00-03:00' })
      .expect(409);
    expect(divergente.body.code).toBe('OPERACAO_DIVERGENTE');
  });

  it('valida estados e não oferece exclusão física de agendamento', async () => {
    db.rows.push(reservaFixture());
    await request(app.getHttpServer())
      .patch('/agendamentos/41/status')
      .set('x-empresa-id', '1')
      .send({ status: 'AGENDADO' })
      .expect(400);
    await request(app.getHttpServer())
      .patch('/agendamentos/41/status')
      .set('x-empresa-id', '1')
      .send({ status: 'FALTOU' })
      .expect(409);
    await request(app.getHttpServer())
      .delete('/agendamentos/41')
      .set('x-empresa-id', '1')
      .expect(404);
    await request(app.getHttpServer())
      .patch('/agendamentos/41/status')
      .set('x-empresa-id', '1')
      .send({ status: 'CANCELADO' })
      .expect(200);
  });

  it('registra falta após o início e remove a reserva do painel', async () => {
    db.rows.push(reservaFixture());
    vi.setSystemTime(new Date('2030-01-07T12:01Z'));
    await request(app.getHttpServer())
      .patch('/agendamentos/41/status')
      .set('x-empresa-id', '1')
      .send({ status: 'FALTOU' })
      .expect(200);
    const response = await request(app.getHttpServer())
      .get('/agendamentos/pendentes')
      .set('x-empresa-id', '1')
      .expect(200);
    expect(response.body).toMatchObject({
      total: 0,
      resumo: { pendentes: 0, atrasados: 0, hoje: 0 },
      items: [],
    });
  });

  it('aplica filtros e paginação na consulta da agenda', async () => {
    db.rows.push(reservaFixture());
    const response = await request(app.getHttpServer())
      .get('/agendamentos')
      .query({
        data: '2030-01-07',
        clienteId: 11,
        profissionalId: 7,
        status: 'AGENDADO',
        pageSize: 1,
      })
      .set('x-empresa-id', '1')
      .expect(200);
    expect(response.body).toMatchObject({ total: 1, pageSize: 1 });
  });

  it.each([
    '/agendamentos?data=2030-02-30',
    '/agendamentos/pendentes?pageSize=101',
    '/agendamentos?status=OUTRO',
  ])('rejeita filtros inválidos em %s', async (path) => {
    await request(app.getHttpServer())
      .get(path)
      .set('x-empresa-id', '1')
      .expect(400);
  });

  it.each([
    { fechamentoMin: 525 },
    { aberturaMin: null },
    { diasFuncionamento: [1, 1] },
    { fusoHorario: 'Fuso/Inexistente' },
  ])('recusa alteração inválida do expediente %s', async (body) => {
    await request(app.getHttpServer())
      .patch('/empresas/1')
      .send(body)
      .expect(400);
    expect(db.empresa.update).not.toHaveBeenCalled();
  });

  it('coordena alteração válida do expediente e consulta de empresas ativas', async () => {
    await request(app.getHttpServer())
      .patch('/empresas/1')
      .send({ aberturaMin: 600 })
      .expect(200);
    expect(db.$queryRaw).toHaveBeenCalled();
    await request(app.getHttpServer()).get('/empresas?ativa=true').expect(200);
    expect(db.empresa.findMany).toHaveBeenCalledWith({
      where: { ativa: true },
      orderBy: { nome: 'asc' },
    });
  });

  it.each([
    ['P2034', 409, 'OPERACAO_CONCORRENTE'],
    ['P2028', 503, 'OPERACAO_INCERTA'],
  ] as const)(
    'trata falha transacional %s com orientação de recuperação',
    async (code, status, resultCode) => {
      vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      db.$transaction.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('detalhe interno', {
          code,
          clientVersion: '7.10.1',
        }),
      );
      const response = await request(app.getHttpServer())
        .post('/agendamentos')
        .set('x-empresa-id', '1')
        .set('Idempotency-Key', CHAVE)
        .send(pedido)
        .expect(status);
      expect(response.body.code).toBe(resultCode);
      expect(response.body.message).toContain('mesma chave');
      expect(JSON.stringify(response.body)).not.toContain('detalhe interno');
    },
  );
});
