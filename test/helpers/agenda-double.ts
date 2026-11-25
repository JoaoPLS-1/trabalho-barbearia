import { Prisma } from '../../src/generated/prisma/client.js';
import type { AgendamentoDetalhado } from '../../src/agendamentos/agendamento-resposta.js';
import { prismaDouble } from './prisma-double.js';

export const CHAVE = '11111111-1111-4111-8111-111111111111';
export const OUTRA_CHAVE = '22222222-2222-4222-8222-222222222222';
export const AGORA = new Date('2030-01-07T10:00:00.000Z');

export function reservaFixture(
  overrides: Partial<AgendamentoDetalhado> = {},
): AgendamentoDetalhado {
  return {
    id: 41,
    empresaId: 1,
    clienteId: 11,
    profissionalId: 7,
    inicio: new Date('2030-01-07T12:00:00Z'),
    fim: new Date('2030-01-07T12:30:00Z'),
    criadoEm: AGORA,
    status: 'AGENDADO',
    chaveOperacao: CHAVE,
    hashPedido: null,
    cliente: { id: 11, nome: 'Cliente Centro', telefone: '11999990001' },
    profissional: { id: 7, nome: 'Profissional Centro' },
    servicos: [
      {
        agendamentoId: 41,
        empresaId: 1,
        servicoId: 9,
        nomeContratado: 'Corte original',
        duracaoContratadaMin: 30,
        precoCobrado: new Prisma.Decimal('40.10'),
      },
    ],
    ...overrides,
  };
}

// Double de transporte e persistência para testar o fluxo HTTP e as regras.
// Não simula locks ou rollback; essas garantias pertencem à suíte MySQL.
export function agendaDouble(initial: AgendamentoDetalhado[] = []) {
  const db = prismaDouble();
  const rows = [...initial];
  function matches(
    item: AgendamentoDetalhado,
    where: Prisma.AgendamentoWhereInput = {},
  ) {
    for (const key of [
      'id',
      'empresaId',
      'clienteId',
      'profissionalId',
      'status',
    ] as const) {
      if (where[key] !== undefined && where[key] !== item[key]) return false;
    }
    for (const key of ['inicio', 'fim'] as const) {
      const filter = where[key] as
        { gt?: Date; gte?: Date; lt?: Date; lte?: Date } | undefined;
      if (!filter) continue;
      if (filter.gt && !(item[key] > filter.gt)) return false;
      if (filter.gte && !(item[key] >= filter.gte)) return false;
      if (filter.lt && !(item[key] < filter.lt)) return false;
      if (filter.lte && !(item[key] <= filter.lte)) return false;
    }
    return true;
  }
  const methods = {
    findUnique: vi.fn(async (args: Prisma.AgendamentoFindUniqueArgs) => {
      const key = args.where.empresaId_chaveOperacao;
      return (
        rows.find(
          (item) =>
            key &&
            item.empresaId === key.empresaId &&
            item.chaveOperacao === key.chaveOperacao,
        ) ?? null
      );
    }),
    findFirst: vi.fn(
      async (args: Prisma.AgendamentoFindFirstArgs) =>
        rows.find((item) => matches(item, args.where)) ?? null,
    ),
    findMany: vi.fn(async (args: Prisma.AgendamentoFindManyArgs) => {
      const items = rows
        .filter((item) => matches(item, args.where))
        .sort((a, b) => a.inicio.getTime() - b.inicio.getTime() || a.id - b.id);
      return items.slice(
        args.skip ?? 0,
        (args.skip ?? 0) + (args.take ?? items.length),
      );
    }),
    count: vi.fn(
      async (args: Prisma.AgendamentoCountArgs) =>
        rows.filter((item) => matches(item, args.where)).length,
    ),
    create: vi.fn(async (args: Prisma.AgendamentoCreateArgs) => {
      const data = args.data as Prisma.AgendamentoUncheckedCreateInput;
      const snapshots = data.servicos?.create as Array<{
        servicoId: number;
        nomeContratado: string;
        duracaoContratadaMin: number;
        precoCobrado: Prisma.Decimal;
      }>;
      const item = reservaFixture({
        id: 41 + rows.length,
        empresaId: data.empresaId,
        clienteId: data.clienteId,
        profissionalId: data.profissionalId,
        inicio: new Date(data.inicio),
        fim: new Date(data.fim),
        chaveOperacao: data.chaveOperacao ?? null,
        hashPedido: data.hashPedido ?? null,
        servicos: snapshots.map((s) => ({
          ...s,
          agendamentoId: 41 + rows.length,
          empresaId: data.empresaId,
          precoCobrado: new Prisma.Decimal(s.precoCobrado),
        })),
      });
      rows.push(item);
      return item;
    }),
    updateMany: vi.fn(async (args: Prisma.AgendamentoUpdateManyArgs) => {
      let count = 0;
      for (const item of rows) {
        if (matches(item, args.where)) {
          item.status = args.data.status as AgendamentoDetalhado['status'];
          count++;
        }
      }
      return { count };
    }),
  };
  const profissional = Object.assign(db.profissional, {
    findFirst: vi.fn(async (args: Prisma.ProfissionalFindFirstArgs) =>
      args.where?.empresaId === 1 && args.where?.id === 7
        ? { id: 7, nome: 'Barbeiro', ativo: true }
        : null,
    ),
  });
  return Object.assign(db, {
    profissional,
    agendamento: Object.assign(db.agendamento, methods),
    rows,
  });
}
