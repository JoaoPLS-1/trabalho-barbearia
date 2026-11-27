import type { Agendamento, Empresa, Pendentes } from '../src/lib/types';

export const empresas: Empresa[] = [
  {
    id: 1,
    nome: 'Barbearia Centro',
    cnpj: '12345678000100',
    telefone: '11999990001',
    ativa: true,
    fusoHorario: 'America/Sao_Paulo',
    aberturaMin: 540,
    fechamentoMin: 1140,
    diasFuncionamento: [1, 2, 3, 4, 5, 6],
  },
  {
    id: 2,
    nome: 'Barbearia Vila Nova',
    cnpj: '98765432000100',
    telefone: '11988880002',
    ativa: true,
    fusoHorario: 'America/Sao_Paulo',
    aberturaMin: 540,
    fechamentoMin: 1140,
    diasFuncionamento: [1, 2, 3, 4, 5, 6],
  },
];
export const agendamento: Agendamento = {
  id: 41,
  empresaId: 1,
  inicio: '2030-01-07T12:00:00Z',
  fim: '2030-01-07T12:30:00Z',
  criadoEm: '2030-01-06T10:00:00Z',
  status: 'AGENDADO',
  atrasado: true,
  cliente: { id: 11, nome: 'Rafael Oliveira', telefone: '11999990011' },
  profissional: { id: 7, nome: 'Bruno Almeida' },
  servicos: [
    {
      servicoId: 9,
      nomeContratado: 'Corte tradicional',
      duracaoContratadaMin: 30,
      precoCobrado: '45.00',
    },
  ],
  total: '45.00',
};
export function painel(empresaId = 1): Pendentes {
  const result: Pendentes = {
    resumo: { pendentes: 4, hoje: 3, atrasados: 2 },
    total: 4,
    page: 1,
    pageSize: 10,
    items: [
      { ...agendamento, empresaId },
      {
        ...agendamento,
        id: 42,
        empresaId,
        cliente: { id: 12, nome: 'Lucas Santos', telefone: '11999990012' },
        profissional: { id: 8, nome: 'Diego Costa' },
        inicio: '2030-01-06T19:00:00Z',
        fim: '2030-01-06T20:00:00Z',
        servicos: [
          {
            servicoId: 10,
            nomeContratado: 'Corte + barba',
            duracaoContratadaMin: 60,
            precoCobrado: '75.00',
          },
        ],
        total: '75.00',
      },
      {
        ...agendamento,
        id: 43,
        empresaId,
        atrasado: false,
        cliente: { id: 13, nome: 'Pedro Henrique', telefone: '11999990013' },
        inicio: '2030-01-07T14:30:00Z',
        fim: '2030-01-07T15:00:00Z',
      },
      {
        ...agendamento,
        id: 44,
        empresaId,
        atrasado: false,
        cliente: { id: 14, nome: 'Gabriel Souza', telefone: '11999990014' },
        inicio: '2030-01-07T15:00:00Z',
        fim: '2030-01-07T15:30:00Z',
        profissional: { id: 8, nome: 'Diego Costa' },
      },
    ],
  };
  result.items.sort(
    (a, b) =>
      Number(Boolean(b.atrasado)) - Number(Boolean(a.atrasado)) ||
      Date.parse(a.inicio) - Date.parse(b.inicio),
  );
  return result;
}
