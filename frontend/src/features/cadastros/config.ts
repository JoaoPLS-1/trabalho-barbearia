export type CadastroKind = 'clientes' | 'profissionais' | 'servicos';
export const cadastros = {
  clientes: {
    title: 'Clientes',
    singular: 'cliente',
    create: 'Novo cliente',
    description: 'Contatos e histórico de quem passa pela barbearia.',
  },
  profissionais: {
    title: 'Profissionais',
    singular: 'profissional',
    create: 'Novo profissional',
    description: 'Organize a equipe disponível para os atendimentos.',
  },
  servicos: {
    title: 'Serviços',
    singular: 'serviço',
    create: 'Novo serviço',
    description: 'Preços e duração dos serviços desta barbearia.',
  },
} as const;
export interface Cadastro {
  id: number;
  empresaId: number;
  nome: string;
  telefone?: string;
  ativo?: boolean;
  preco?: string;
  duracaoMin?: number;
}
export function decimalPrice(value: string): string | null {
  const text = value.trim();
  if (!/^\d{1,8}([,.]\d{1,2})?$/.test(text)) return null;
  const [integer, fraction = ''] = text.replace(',', '.').split('.');
  const result =
    integer.replace(/^0+(?=\d)/, '') + '.' + fraction.padEnd(2, '0');
  return result === '0.00' ? null : result;
}
