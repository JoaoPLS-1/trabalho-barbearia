export interface Empresa {
  id: number;
  nome: string;
  cnpj: string;
  telefone: string | null;
  ativa: boolean;
  fusoHorario: string;
  aberturaMin: number;
  fechamentoMin: number;
  diasFuncionamento: number[];
}
export interface Profissional {
  id: number;
  nome: string;
  ativo: boolean;
  empresaId: number;
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface Agendamento {
  id: number;
  empresaId: number;
  inicio: string;
  fim: string;
  criadoEm: string;
  status: 'AGENDADO' | 'CONCLUIDO' | 'CANCELADO' | 'FALTOU';
  atrasado?: boolean;
  cliente: { id: number; nome: string; telefone: string };
  profissional: { id: number; nome: string };
  servicos: Array<{
    servicoId: number;
    nomeContratado: string;
    duracaoContratadaMin: number;
    precoCobrado: string;
  }>;
  total: string;
}
export interface Pendentes extends Page<Agendamento> {
  resumo: { pendentes: number; atrasados: number; hoje: number };
}
