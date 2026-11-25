import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/common/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { prismaDouble } from './helpers/prisma-double.js';

describe('Cadastros HTTP sem banco', () => {
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

  it('normaliza nome e telefone brasileiro com código do país', async () => {
    const response = await request(app.getHttpServer())
      .post('/clientes')
      .set('x-empresa-id', '1')
      .send({ nome: '  Ana  ', telefone: '+55 (11) 99999-0003' })
      .expect(201);
    expect(response.body).toMatchObject({
      nome: 'Ana',
      telefone: '11999990003',
      empresaId: 1,
    });
  });

  it.each(['   ', null])('rejeita nome vazio ou nulo: %s', async (nome) => {
    await request(app.getHttpServer())
      .post('/clientes')
      .set('x-empresa-id', '1')
      .send({ nome, telefone: '11999990003' })
      .expect(400);
    expect(prisma.cliente.create).not.toHaveBeenCalled();
  });

  it('não aceita letras no telefone', async () => {
    await request(app.getHttpServer())
      .post('/clientes')
      .set('x-empresa-id', '1')
      .send({ nome: 'Ana', telefone: 'abc11999990003' })
      .expect(400);
  });

  it('aplica a normalização e a unicidade também na edição', async () => {
    prisma.cliente.findUnique.mockResolvedValue({ id: 22 });
    const response = await request(app.getHttpServer())
      .patch('/clientes/11')
      .set('x-empresa-id', '1')
      .send({ telefone: '(11) 99999-0002' })
      .expect(409);
    expect(response.body.code).toBe('TELEFONE_DUPLICADO');
    expect(prisma.cliente.findUnique).toHaveBeenCalledWith({
      where: { empresaId_telefone: { empresaId: 1, telefone: '11999990002' } },
    });
    expect(prisma.cliente.update).not.toHaveBeenCalled();
  });

  it.each([
    '/clientes?page=0',
    '/clientes?pageSize=101',
    '/clientes?busca[x]=Ana',
    '/profissionais?ativo=talvez',
    '/servicos?ativo=1',
    '/clientes?empresaId=2',
  ])('rejeita consulta inválida %s', async (path) => {
    await request(app.getHttpServer())
      .get(path)
      .set('x-empresa-id', '1')
      .expect(400);
  });

  it('retorna envelope paginado para os clientes', async () => {
    const response = await request(app.getHttpServer())
      .get('/clientes?page=1&pageSize=5')
      .set('x-empresa-id', '1')
      .expect(200);
    expect(response.body).toMatchObject({ total: 1, page: 1, pageSize: 5 });
    expect(response.body.items).toHaveLength(1);
  });

  it('trata false como inativos em vez de ignorar o filtro', async () => {
    await request(app.getHttpServer())
      .get('/profissionais?ativo=false')
      .set('x-empresa-id', '1')
      .expect(200);
    expect(prisma.profissional.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { empresaId: 1, ativo: false },
      }),
    );
  });

  it('aceita preço decimal exato e devolve duas casas', async () => {
    const response = await request(app.getHttpServer())
      .post('/servicos')
      .set('x-empresa-id', '1')
      .send({ nome: 'Corte', preco: '40.10', duracaoMin: 30 })
      .expect(201);
    expect(response.body.preco).toBe('40.10');
  });

  it.each([40.1, '0.00', '-1.00', '1.001', '100000000.00', null])(
    'recusa preço inválido %s',
    async (preco) => {
      await request(app.getHttpServer())
        .post('/servicos')
        .set('x-empresa-id', '1')
        .send({ nome: 'Corte', preco, duracaoMin: 30 })
        .expect(400);
      expect(prisma.servico.create).not.toHaveBeenCalled();
    },
  );

  it.each(['clientes', 'profissionais', 'servicos'])(
    'recusa edição nula e IDs inválidos em %s',
    async (resource) => {
      await request(app.getHttpServer())
        .patch('/' + resource + '/1')
        .set('x-empresa-id', '1')
        .send({ nome: null })
        .expect(400);
      await request(app.getHttpServer())
        .get('/' + resource + '/-1')
        .set('x-empresa-id', '1')
        .expect(400);
    },
  );

  it.each(['profissionais', 'servicos'])(
    'recusa situação nula em %s',
    async (resource) => {
      await request(app.getHttpServer())
        .patch('/' + resource + '/1')
        .set('x-empresa-id', '1')
        .send({ ativo: null })
        .expect(400);
    },
  );

  it('desativa serviço preservando a tabela de itens contratados', async () => {
    const response = await request(app.getHttpServer())
      .patch('/servicos/9')
      .set('x-empresa-id', '1')
      .send({ ativo: false })
      .expect(200);
    expect(response.body.ativo).toBe(false);
    expect(prisma.servico.delete).not.toHaveBeenCalled();
    expect(prisma.agendamentoServico.updateMany).not.toHaveBeenCalled();
  });
});
