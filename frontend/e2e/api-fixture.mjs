import { Test } from '@nestjs/testing';
import { AppModule } from '../../dist/app.module.js';
import { PrismaService } from '../../dist/prisma/prisma.service.js';
import { configureApp } from '../../dist/common/configure-app.js';
import { Prisma } from '../../dist/generated/prisma/client.js';

if (process.env.NODE_ENV !== 'test')
  throw new Error('Servidor exclusivo para testes de navegador.');

const empresas = [1, 2].map((id) => ({
  id,
  nome: id === 1 ? 'API Centro' : 'API Vila',
  cnpj: id === 1 ? '12345678000100' : '98765432000100',
  telefone: '11999990001',
  ativa: true,
  fusoHorario: 'America/Sao_Paulo',
  aberturaMin: 540,
  fechamentoMin: 1140,
  diasFuncionamento: [1, 2, 3, 4, 5, 6],
}));
const profissionais = empresas.map((empresa) => ({
  id: empresa.id + 10,
  empresaId: empresa.id,
  nome: 'Profissional API ' + empresa.id,
  ativo: true,
}));
const registros = empresas.map((empresa) => ({
  id: empresa.id + 40,
  empresaId: empresa.id,
  clienteId: empresa.id + 20,
  profissionalId: empresa.id + 10,
  inicio: new Date('2030-01-07T12:00:00Z'),
  fim: new Date('2030-01-07T12:30:00Z'),
  criadoEm: new Date('2030-01-06T10:00:00Z'),
  status: 'AGENDADO',
  chaveOperacao: null,
  hashPedido: null,
  cliente: {
    id: empresa.id + 20,
    nome: empresa.id === 1 ? 'Cliente HTTP Centro' : 'Cliente HTTP Vila',
    telefone: '11999990001',
  },
  profissional: { id: empresa.id + 10, nome: 'Profissional API ' + empresa.id },
  servicos: [
    {
      empresaId: empresa.id,
      agendamentoId: empresa.id + 40,
      servicoId: empresa.id + 30,
      nomeContratado: 'Corte HTTP',
      duracaoContratadaMin: 30,
      precoCobrado: new Prisma.Decimal('40.10'),
    },
  ],
}));

const clientes = empresas.map((empresa) => ({
  id: empresa.id + 20,
  empresaId: empresa.id,
  nome: empresa.id === 1 ? 'Cliente HTTP Centro' : 'Cliente HTTP Vila',
  telefone: '11999990001',
}));
const servicos = empresas.map((empresa) => ({
  id: empresa.id + 30,
  empresaId: empresa.id,
  nome: 'Corte HTTP',
  preco: new Prisma.Decimal('40.10'),
  duracaoMin: 30,
  ativo: true,
}));
let nextId = 100;
function repository(items, monetary = false) {
  const find = (where) =>
    items.find((item) => matches(item, where.empresaId_telefone ?? where)) ??
    null;
  return {
    findMany: async ({ where, skip = 0, take = 100 }) =>
      items
        .filter((item) => matches(item, where))
        .sort((a, b) => a.nome.localeCompare(b.nome) || a.id - b.id)
        .slice(skip, skip + take),
    count: async ({ where }) =>
      items.filter((item) => matches(item, where)).length,
    findFirst: async ({ where }) => find(where),
    findUnique: async ({ where }) => find(where),
    create: async ({ data }) => {
      const item = {
        id: nextId++,
        ...(items !== clientes ? { ativo: true } : {}),
        ...data,
      };
      if (monetary) item.preco = new Prisma.Decimal(item.preco);
      items.push(item);
      return item;
    },
    update: async ({ where, data }) => {
      const item = find(where);
      if (!item) throw new Error('Fixture inexistente');
      Object.assign(item, data);
      if (monetary && data.preco !== undefined)
        item.preco = new Prisma.Decimal(data.preco);
      return item;
    },
  };
}

function matches(item, where = {}) {
  if (where.OR && !where.OR.some((part) => matches(item, part))) return false;
  for (const field of ['nome', 'telefone']) {
    if (typeof where[field] === 'string' && where[field] !== item[field])
      return false;
    if (
      where[field]?.contains &&
      !item[field]?.toLowerCase().includes(where[field].contains.toLowerCase())
    )
      return false;
  }
  for (const field of [
    'id',
    'empresaId',
    'clienteId',
    'profissionalId',
    'status',
    'ativo',
  ]) {
    if (where[field] !== undefined && where[field] !== item[field])
      return false;
  }
  for (const field of ['inicio', 'fim']) {
    const filter = where[field];
    if (filter?.gte && !(item[field] >= filter.gte)) return false;
    if (filter?.gt && !(item[field] > filter.gt)) return false;
    if (filter?.lt && !(item[field] < filter.lt)) return false;
  }
  return true;
}
const prisma = {
  $transaction: async (work) =>
    typeof work === 'function' ? work(prisma) : Promise.all(work),
  empresa: {
    findMany: async ({ where }) =>
      empresas.filter((item) => matches(item, where)),
    findUnique: async ({ where }) =>
      empresas.find((item) => matches(item, where)) ?? null,
  },
  $queryRaw: async (_query, id) =>
    empresas.filter((item) => item.id === id).map(({ id }) => ({ id })),
  cliente: repository(clientes),
  profissional: repository(profissionais),
  servico: repository(servicos, true),
  agendamento: {
    findMany: async ({ where, skip = 0, take = 100 }) =>
      registros
        .filter((item) => matches(item, where))
        .sort((a, b) => a.inicio - b.inicio || a.id - b.id)
        .slice(skip, skip + take),
    count: async ({ where }) =>
      registros.filter((item) => matches(item, where)).length,
    findFirst: async ({ where }) =>
      registros.find((item) => matches(item, where)) ?? null,
  },
};

const module = await Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(PrismaService)
  .useValue(prisma)
  .compile();
const app = module.createNestApplication({ logger: false });
configureApp(app, ['http://127.0.0.1:5173']);
await app.listen(43117, '127.0.0.1');
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
