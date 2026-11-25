import { vi } from 'vitest';

export function prismaDouble() {
  const empresas = [
    { id: 1, nome: 'Centro', ativa: true },
    { id: 2, nome: 'Bairro', ativa: true },
    { id: 3, nome: 'Fechada', ativa: false },
  ];
  const clientes = [
    { id: 11, empresaId: 1, nome: 'Cliente Centro', telefone: '11999990001' },
    { id: 22, empresaId: 2, nome: 'Cliente Bairro', telefone: '11999990002' },
  ];

  return {
    empresa: {
      findUnique: vi.fn(
        async ({ where }: { where: { id: number } }) =>
          empresas.find((empresa) => empresa.id === where.id) ?? null,
      ),
    },
    cliente: {
      findMany: vi.fn(async ({ where }: { where: { empresaId: number } }) =>
        clientes.filter((cliente) => cliente.empresaId === where.empresaId),
      ),
      findFirst: vi.fn(
        async ({ where }: { where: { id: number; empresaId: number } }) =>
          clientes.find(
            (cliente) =>
              cliente.id === where.id && cliente.empresaId === where.empresaId,
          ) ?? null,
      ),
      findUnique: vi.fn(async () => null),
      create: vi.fn(
        async ({
          data,
        }: {
          data: { nome: string; telefone: string; empresaId: number };
        }) => ({ id: 33, ...data }),
      ),
    },
    servico: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    agendamentoServico: {
      count: vi.fn(async () => 0),
    },
  };
}
