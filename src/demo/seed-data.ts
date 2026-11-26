import { createHash } from 'node:crypto';
import { Temporal } from '@js-temporal/polyfill';

export const DEMO_COMPANIES = [
  {
    id: 10001,
    nome: 'Barbearia Aurora — Centro (demo)',
    cnpj: '00000000000191',
    telefone: '11999990001',
    fusoHorario: 'America/Sao_Paulo',
  },
  {
    id: 10002,
    nome: 'Barbearia Aurora — Vila (demo)',
    cnpj: '00000000000272',
    telefone: '92999990002',
    fusoHorario: 'America/Manaus',
  },
] as const;
export function demoKey(value: string) {
  const hex = createHash('sha256')
    .update('barbearia-demo-v1:' + value)
    .digest('hex')
    .slice(0, 32)
    .split('');
  hex[12] = '4';
  hex[16] = ['8', '9', 'a', 'b'][parseInt(hex[16], 16) % 4];
  const id = hex.join('');
  return [
    id.slice(0, 8),
    id.slice(8, 12),
    id.slice(12, 16),
    id.slice(16, 20),
    id.slice(20),
  ].join('-');
}
export function seedPlan(now: Date) {
  if (!Number.isFinite(now.getTime()))
    throw new Error('Data de demonstração inválida.');
  return DEMO_COMPANIES.map((company, index) => {
    const base = 10000 + index * 100;
    const day = Temporal.Instant.from(now.toISOString())
      .toZonedDateTimeISO(company.fusoHorario)
      .toPlainDate();
    const instant = (offset: number, hour: number) =>
      new Date(
        day
          .add({ days: offset })
          .toPlainDateTime({ hour })
          .toZonedDateTime(company.fusoHorario).epochMilliseconds,
      );
    const clientes = ['Rafael Oliveira', 'Lucas Santos', 'Pedro Alves'].map(
      (nome, i) => ({
        id: base + i + 1,
        empresaId: company.id,
        nome,
        telefone: '1199999000' + (i + 1),
      }),
    );
    const profissionais = ['Bruno Almeida', 'Diego Costa', 'Carlos Mendes'].map(
      (nome, i) => ({
        id: base + i + 1,
        empresaId: company.id,
        nome,
        ativo: i < 2,
      }),
    );
    const servicos = [
      {
        nome: 'Corte tradicional',
        preco: '40.10',
        duracaoMin: 30,
        ativo: true,
      },
      { nome: 'Barba', preco: '25.00', duracaoMin: 20, ativo: true },
      { nome: 'Corte e barba', preco: '60.00', duracaoMin: 50, ativo: true },
      {
        nome: 'Contorno (descontinuado)',
        preco: '15.00',
        duracaoMin: 15,
        ativo: false,
      },
    ].map((service, i) => ({
      ...service,
      id: base + i + 1,
      empresaId: company.id,
    }));
    const scenarios = [
      {
        name: 'atrasado',
        offset: -1,
        hour: 10,
        cliente: 0,
        profissional: 0,
        services: [0],
        status: 'AGENDADO' as const,
      },
      {
        name: 'futuro-corte-barba',
        offset: 1,
        hour: 10,
        cliente: 1,
        profissional: 0,
        services: [0, 1],
        status: 'AGENDADO' as const,
      },
      {
        name: 'futuro-corte',
        offset: 1,
        hour: 11,
        cliente: 2,
        profissional: 1,
        services: [0],
        status: 'AGENDADO' as const,
      },
      {
        name: 'concluido',
        offset: -2,
        hour: 10,
        cliente: 0,
        profissional: 0,
        services: [0],
        status: 'CONCLUIDO' as const,
      },
      {
        name: 'cancelado',
        offset: -2,
        hour: 11,
        cliente: 1,
        profissional: 1,
        services: [2],
        status: 'CANCELADO' as const,
      },
      {
        name: 'faltou-inativo',
        offset: -2,
        hour: 12,
        cliente: 2,
        profissional: 2,
        services: [3],
        status: 'FALTOU' as const,
      },
    ];
    return {
      company: {
        ...company,
        ativa: true,
        aberturaMin: 540,
        fechamentoMin: 1140,
        diasFuncionamento: [1, 2, 3, 4, 5, 6, 7],
      },
      clientes,
      profissionais,
      servicos,
      day: day.toString(),
      agendamentos: scenarios.map((scenario) => {
        const inicio = instant(scenario.offset, scenario.hour);
        const services = scenario.services.map((i) => servicos[i]);
        const precoHistorico = scenario.status === 'CONCLUIDO';
        const items = services.map((service) => ({
          empresaId: company.id,
          servicoId: service.id,
          nomeContratado: precoHistorico
            ? 'Corte clássico (contratado)'
            : service.nome,
          duracaoContratadaMin: service.duracaoMin,
          precoCobrado: precoHistorico ? '35.00' : service.preco,
        }));
        const body = {
          clienteId: clientes[scenario.cliente].id,
          profissionalId: profissionais[scenario.profissional].id,
          servicoIds: services
            .map((service) => service.id)
            .sort((a, b) => a - b),
          inicio: inicio.toISOString(),
        };
        return {
          empresaId: company.id,
          clienteId: body.clienteId,
          profissionalId: body.profissionalId,
          inicio,
          fim: new Date(
            inicio.getTime() +
              items.reduce((sum, item) => sum + item.duracaoContratadaMin, 0) *
                60000,
          ),
          status: scenario.status,
          chaveOperacao: demoKey(
            company.id + ':' + day.toString() + ':' + scenario.name,
          ),
          hashPedido: createHash('sha256')
            .update(JSON.stringify(body))
            .digest('hex'),
          servicos: items,
        };
      }),
    };
  });
}
