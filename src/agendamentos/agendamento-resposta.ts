import { Prisma } from '../generated/prisma/client.js';

export const DETALHES = {
  cliente: { select: { id: true, nome: true, telefone: true } },
  profissional: { select: { id: true, nome: true } },
  servicos: { orderBy: { servicoId: 'asc' } },
} satisfies Prisma.AgendamentoInclude;

export type AgendamentoDetalhado = Prisma.AgendamentoGetPayload<{
  include: typeof DETALHES;
}>;

export function respostaAgendamento(item: AgendamentoDetalhado) {
  return {
    id: item.id,
    empresaId: item.empresaId,
    inicio: item.inicio.toISOString(),
    fim: item.fim.toISOString(),
    status: item.status,
    criadoEm: item.criadoEm.toISOString(),
    cliente: item.cliente,
    profissional: item.profissional,
    servicos: item.servicos.map((servico) => ({
      servicoId: servico.servicoId,
      nomeContratado: servico.nomeContratado,
      duracaoContratadaMin: servico.duracaoContratadaMin,
      precoCobrado: servico.precoCobrado.toFixed(2),
    })),
    total: item.servicos
      .reduce(
        (sum, servico) => sum.plus(servico.precoCobrado),
        new Prisma.Decimal(0),
      )
      .toFixed(2),
  };
}
