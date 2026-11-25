import { AgendamentosService } from './agendamentos.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { EmpresasService } from '../empresas/empresas.service.js';

describe('Dados contratados na reserva', () => {
  function setup() {
    const prisma = {
      cliente: { findFirst: vi.fn(async () => ({ id: 1 })) },
      profissional: {
        findFirst: vi.fn(async () => ({
          id: 2,
          nome: 'Barbeiro',
          ativo: true,
        })),
      },
      servico: {
        findMany: vi.fn(async () => [
          {
            id: 3,
            nome: 'Corte original',
            duracaoMin: 30,
            preco: new Prisma.Decimal('40.10'),
          },
        ]),
      },
      agendamento: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async () => ({ id: 4 })),
      },
    };
    const service = new AgendamentosService(
      prisma as unknown as PrismaService,
      { validarEmpresaAtiva: vi.fn() } as unknown as EmpresasService,
    );
    const dto = {
      clienteId: 1,
      profissionalId: 2,
      servicoIds: [3],
      inicio: new Date(Date.now() + 86400000).toISOString(),
    };
    return { prisma, service, dto };
  }

  it('copia preço decimal, nome e duração ao criar a reserva', async () => {
    const { prisma, service, dto } = setup();
    await service.create(1, dto);
    expect(prisma.servico.findMany).toHaveBeenCalledWith({
      where: { empresaId: 1, ativo: true, id: { in: [3] } },
    });
    expect(prisma.agendamento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          empresaId: 1,
          servicos: {
            create: [
              {
                servicoId: 3,
                nomeContratado: 'Corte original',
                duracaoContratadaMin: 30,
                precoCobrado: new Prisma.Decimal('40.10'),
              },
            ],
          },
        }),
      }),
    );
  });

  it('não grava quando serviço foi desativado ou pertence a outra empresa', async () => {
    const { prisma, service, dto } = setup();
    prisma.servico.findMany.mockResolvedValue([]);
    await expect(service.create(1, dto)).rejects.toThrow(
      'não encontrado ou inativo',
    );
    expect(prisma.agendamento.create).not.toHaveBeenCalled();
  });
});
