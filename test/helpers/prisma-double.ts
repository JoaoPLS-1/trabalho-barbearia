import { vi } from 'vitest';
import { Prisma } from '../../src/generated/prisma/client.js';

export function prismaDouble() {
  const expediente = {
    fusoHorario: 'America/Sao_Paulo',
    aberturaMin: 540,
    fechamentoMin: 1140,
    diasFuncionamento: [1, 2, 3, 4, 5, 6],
  };
  const empresas = [
    { ...expediente, id: 1, nome: 'Centro', ativa: true },
    { ...expediente, id: 2, nome: 'Bairro', ativa: true },
    { ...expediente, id: 3, nome: 'Fechada', ativa: false },
  ];
  const clientes = [
    { id: 11, empresaId: 1, nome: 'Cliente Centro', telefone: '11999990001' },
    { id: 22, empresaId: 2, nome: 'Cliente Bairro', telefone: '11999990002' },
  ];
  const profissional = {
    id: 7,
    empresaId: 1,
    nome: 'Profissional Centro',
    ativo: true,
  };
  const servico = {
    id: 9,
    empresaId: 1,
    nome: 'Corte',
    ativo: true,
    preco: new Prisma.Decimal('40.00'),
    duracaoMin: 30,
  };

  const prisma = {
    $queryRaw: vi.fn(async (..._args: unknown[]) => [{ id: 1 }]),
    $transaction: vi.fn(async (operations: unknown): Promise<unknown> =>
      typeof operations === 'function'
        ? operations(prisma)
        : Promise.all(operations as Promise<unknown>[]),
    ),
    empresa: {
      findMany: vi.fn(async () => empresas),
      update: vi.fn(
        async ({ where, data }: { where: { id: number }; data: object }) => ({
          ...empresas.find((e) => e.id === where.id),
          ...data,
        }),
      ),
      findUnique: vi.fn(
        async ({ where }: { where: { id: number } }) =>
          empresas.find((empresa) => empresa.id === where.id) ?? null,
      ),
    },
    cliente: {
      // Este double aplica somente o contexto. Busca e SQL sao validados nos
      // argumentos da consulta e na suite de integracao, nao por um banco simulado.
      findMany: vi.fn(async (args: Prisma.ClienteFindManyArgs) =>
        clientes.filter(
          (cliente) => cliente.empresaId === args.where?.empresaId,
        ),
      ),
      count: vi.fn(
        async (args: Prisma.ClienteCountArgs) =>
          clientes.filter(
            (cliente) => cliente.empresaId === args.where?.empresaId,
          ).length,
      ),
      findFirst: vi.fn(
        async ({ where }: { where: { id: number; empresaId: number } }) =>
          clientes.find(
            (cliente) =>
              cliente.id === where.id && cliente.empresaId === where.empresaId,
          ) ?? null,
      ),
      findUnique: vi.fn<
        (args: Prisma.ClienteFindUniqueArgs) => Promise<{ id: number } | null>
      >(async () => null),
      create: vi.fn(
        async ({
          data,
        }: {
          data: { nome: string; telefone: string; empresaId: number };
        }) => ({ id: 33, ...data }),
      ),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: number; empresaId: number };
          data: object;
        }) => ({ ...where, ...data }),
      ),
      delete: vi.fn(
        async ({ where }: { where: { id: number; empresaId: number } }) =>
          where,
      ),
    },
    profissional: {
      findUnique: vi.fn(async (args: Prisma.ProfissionalFindUniqueArgs) =>
        args.where.id === profissional.id &&
        args.where.empresaId === profissional.empresaId
          ? profissional
          : null,
      ),
      findMany: vi.fn(async (args: Prisma.ProfissionalFindManyArgs) =>
        args.where?.empresaId === 1 ? [profissional] : [],
      ),
      count: vi.fn(async () => 1),
      create: vi.fn(),
      update: vi.fn(async ({ data }: { data: object }) => ({
        ...profissional,
        ...data,
      })),
      delete: vi.fn(),
    },
    servico: {
      findUnique: vi.fn(
        async (args: Prisma.ServicoFindUniqueArgs): Promise<unknown> =>
          args.where.id === servico.id &&
          args.where.empresaId === servico.empresaId
            ? servico
            : null,
      ),
      findMany: vi.fn(async (args: Prisma.ServicoFindManyArgs) =>
        args.where?.empresaId === 1 ? [servico] : [],
      ),
      count: vi.fn(async () => 1),
      create: vi.fn(async ({ data }: { data: object }) => ({
        ...servico,
        ...data,
        preco: new Prisma.Decimal((data as { preco: string }).preco),
      })),
      update: vi.fn(async ({ data }: { data: object }) => ({
        ...servico,
        ...data,
        preco: new Prisma.Decimal(
          (data as { preco?: string }).preco ?? servico.preco,
        ),
      })),
      delete: vi.fn(async (): Promise<unknown> => servico),
    },
    agendamento: {
      count: vi.fn(async () => 0),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    agendamentoServico: {
      count: vi.fn(async () => 0),
      updateMany: vi.fn(),
    },
  };
  return prisma;
}
