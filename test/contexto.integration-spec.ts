import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/common/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Contexto de empresa com MySQL real', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const empresas: number[] = [];
  let clienteOutraEmpresa: number;
  let empresaInativa: number;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app, ['http://localhost:5173']);
    await app.init();
    prisma = app.get(PrismaService);

    for (const nome of ['Teste Centro', 'Teste Bairro']) {
      const empresa = await prisma.empresa.create({
        data: {
          nome,
          cnpj:
            randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase() + '00',
        },
      });
      empresas.push(empresa.id);
    }
    const cliente = await prisma.cliente.create({
      data: {
        nome: 'Cliente da outra empresa',
        telefone: '11999990001',
        empresaId: empresas[1],
      },
    });
    clienteOutraEmpresa = cliente.id;
    const inativa = await prisma.empresa.create({
      data: {
        nome: 'Teste Inativa',
        cnpj:
          randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase() + '00',
        ativa: false,
      },
    });
    empresaInativa = inativa.id;
    empresas.push(inativa.id);
  });

  afterAll(async () => {
    try {
      if (prisma && empresas.length) {
        // Remover apenas os registros criados por esta suíte.
        await prisma.cliente.deleteMany({
          where: { empresaId: { in: empresas } },
        });
        await prisma.empresa.deleteMany({ where: { id: { in: empresas } } });
      }
    } finally {
      await app?.close();
    }
  });

  it('não encontra um cliente da empresa vizinha', async () => {
    await request(app.getHttpServer())
      .get(`/clientes/${clienteOutraEmpresa}`)
      .set('x-empresa-id', String(empresas[0]))
      .expect(404);
    await request(app.getHttpServer())
      .get(`/clientes/${clienteOutraEmpresa}`)
      .set('x-empresa-id', String(empresas[1]))
      .expect(200);
  });

  it('permite o mesmo telefone em empresas diferentes', async () => {
    await request(app.getHttpServer())
      .post('/clientes')
      .set('x-empresa-id', String(empresas[0]))
      .send({ nome: 'Outro cliente', telefone: '11999990001' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/clientes')
      .set('x-empresa-id', String(empresas[0]))
      .send({ nome: 'Duplicado', telefone: '11999990001' })
      .expect(409);
  });

  it('recusa cadastro em empresa inativa', async () => {
    await request(app.getHttpServer())
      .post('/clientes')
      .set('x-empresa-id', String(empresaInativa))
      .send({ nome: 'Bloqueado', telefone: '11999990002' })
      .expect(400);
    expect(
      await prisma.cliente.count({ where: { empresaId: empresaInativa } }),
    ).toBe(0);
  });

  it('bloqueia edição e exclusão de cliente de outra empresa', async () => {
    await request(app.getHttpServer())
      .patch(`/clientes/${clienteOutraEmpresa}`)
      .set('x-empresa-id', String(empresas[0]))
      .send({ nome: 'Alterado indevidamente' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/clientes/${clienteOutraEmpresa}`)
      .set('x-empresa-id', String(empresas[0]))
      .expect(404);
    const cliente = await prisma.cliente.findUnique({
      where: { id: clienteOutraEmpresa },
    });
    expect(cliente?.nome).toBe('Cliente da outra empresa');
  });
});
