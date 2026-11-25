import { Logger, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/common/configure-app.js';
import { Prisma } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { prismaDouble } from './helpers/prisma-double.js';

describe('API HTTP sem banco (Prisma substituído)', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof prismaDouble>;

  beforeEach(async () => {
    prisma = prismaDouble();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = module.createNestApplication();
    configureApp(app, ['http://localhost:5173']);
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('responde a verificação inicial', async () => {
    await request(app.getHttpServer()).get('/').expect(200, 'Hello World!');
  });

  it('permite preflight com empresa e chave de operação', async () => {
    const response = await request(app.getHttpServer())
      .options('/clientes')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set(
        'Access-Control-Request-Headers',
        'content-type,x-empresa-id,idempotency-key',
      )
      .expect(204);
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
    expect(
      response.headers['access-control-allow-headers'].toLowerCase(),
    ).toContain('x-empresa-id');
    expect(
      response.headers['access-control-allow-headers'].toLowerCase(),
    ).toContain('idempotency-key');
  });

  it('não libera outra origem no navegador', async () => {
    const response = await request(app.getHttpServer())
      .get('/')
      .set('Origin', 'https://outra-origem.example')
      .expect(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it.each([
    undefined,
    '0',
    '-1',
    'abc',
    '1.5',
    '1e0',
    '0x1',
    '9007199254740992',
  ])('rejeita contexto de empresa inválido: %s', async (value) => {
    const pending = request(app.getHttpServer()).get('/clientes');
    if (value !== undefined) pending.set('x-empresa-id', value);
    const response = await pending.expect(400);
    expect(response.body.code).toBe('VALIDACAO');
    expect(prisma.cliente.findMany).not.toHaveBeenCalled();
  });

  it('rejeita empresa inexistente', async () => {
    const response = await request(app.getHttpServer())
      .get('/clientes')
      .set('x-empresa-id', '99')
      .expect(404);
    expect(response.body.code).toBe('NAO_ENCONTRADO');
    expect(prisma.cliente.findMany).not.toHaveBeenCalled();
  });

  it('rejeita empresa inativa antes de consultar clientes', async () => {
    await request(app.getHttpServer())
      .get('/clientes')
      .set('x-empresa-id', '3')
      .expect(400);
    expect(prisma.cliente.findMany).not.toHaveBeenCalled();
  });

  it('encaminha o contexto da empresa à consulta de clientes', async () => {
    const response = await request(app.getHttpServer())
      .get('/clientes')
      .set('x-empresa-id', '1')
      .expect(200);
    expect(response.body.map((cliente: { id: number }) => cliente.id)).toEqual([
      11,
    ]);
    expect(prisma.cliente.findMany).toHaveBeenCalledWith({
      where: { empresaId: 1 },
    });
  });

  it('não retorna cliente de outra empresa', async () => {
    await request(app.getHttpServer())
      .get('/clientes/22')
      .set('x-empresa-id', '1')
      .expect(404);
    expect(prisma.cliente.findFirst).toHaveBeenCalledWith({
      where: { id: 22, empresaId: 1 },
    });
  });

  it('valida DTO em tempo de execução e identifica os campos', async () => {
    const response = await request(app.getHttpServer())
      .post('/clientes')
      .set('x-empresa-id', '1')
      .send({ nome: '', telefone: 'invalido' })
      .expect(400);
    expect(response.body.code).toBe('VALIDACAO');
    expect(response.body.fieldErrors.nome).toBeDefined();
    expect(response.body.fieldErrors.telefone).toBeDefined();
    expect(prisma.cliente.create).not.toHaveBeenCalled();
  });

  it('recusa tentativa de definir empresa pelo corpo', async () => {
    const response = await request(app.getHttpServer())
      .post('/clientes')
      .set('x-empresa-id', '1')
      .send({ nome: 'Novo cliente', telefone: '11999990003', empresaId: 2 })
      .expect(400);
    expect(response.body.fieldErrors.empresaId).toBeDefined();
    expect(prisma.cliente.create).not.toHaveBeenCalled();
  });

  it('cadastra cliente válido na empresa do header', async () => {
    const response = await request(app.getHttpServer())
      .post('/clientes')
      .set('x-empresa-id', '1')
      .send({ nome: 'Novo cliente', telefone: '11999990003' })
      .expect(201);
    expect(response.body.empresaId).toBe(1);
    expect(prisma.cliente.create).toHaveBeenCalledWith({
      data: { nome: 'Novo cliente', telefone: '11999990003', empresaId: 1 },
    });
  });

  it('rejeita ID de URL inválido sem consultar cliente', async () => {
    await request(app.getHttpServer())
      .get('/clientes/invalido')
      .set('x-empresa-id', '1')
      .expect(400);
    expect(prisma.cliente.findFirst).not.toHaveBeenCalled();
  });

  it.each([
    ['P2002', 409, 'REGISTRO_DUPLICADO'],
    ['P2003', 409, 'REGISTRO_VINCULADO'],
    ['P2025', 404, 'NAO_ENCONTRADO'],
  ] as const)(
    'traduz erro Prisma %s sem expor detalhes do banco',
    async (prismaCode, status, apiCode) => {
      prisma.cliente.findMany.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('SQL com detalhe interno', {
          code: prismaCode,
          clientVersion: '7.10.1',
        }),
      );
      const response = await request(app.getHttpServer())
        .get('/clientes')
        .set('x-empresa-id', '1')
        .expect(status);
      expect(response.body.code).toBe(apiCode);
      expect(JSON.stringify(response.body)).not.toMatch(
        /SQL|detalhe interno|stack/,
      );
    },
  );

  it('oculta detalhes internos de falhas inesperadas', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    prisma.cliente.findMany.mockRejectedValueOnce(
      new Error('SQL com segredo interno'),
    );
    const response = await request(app.getHttpServer())
      .get('/clientes')
      .set('x-empresa-id', '1')
      .expect(500);
    expect(response.body.code).toBe('ERRO_INTERNO');
    expect(JSON.stringify(response.body)).not.toMatch(/SQL|segredo|stack/);
    expect(Logger.prototype.error).toHaveBeenCalled();
  });
});
