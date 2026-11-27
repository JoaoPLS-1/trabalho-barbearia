import { createHash } from 'node:crypto';
import { demoKey, seedPlan } from './seed-data.js';

describe('Plano de demonstração sem acesso ao banco', () => {
  const now = new Date('2026-11-26T15:00:00Z');
  it('separa empresas e vínculos, mantendo nomes e telefones semelhantes para o ensaio', () => {
    const groups = seedPlan(now);
    expect(groups).toHaveLength(2);
    expect(groups[0].company.id).not.toBe(groups[1].company.id);
    expect(groups[0].clientes[0].telefone).toBe(groups[1].clientes[0].telefone);
    for (const group of groups)
      for (const item of group.agendamentos) {
        expect(
          group.clientes.some(
            (c) => c.id === item.clienteId && c.empresaId === item.empresaId,
          ),
        ).toBe(true);
        expect(
          group.profissionais.some(
            (p) =>
              p.id === item.profissionalId && p.empresaId === item.empresaId,
          ),
        ).toBe(true);
        expect(
          item.servicos.every((s) =>
            group.servicos.some(
              (original) =>
                original.id === s.servicoId &&
                original.empresaId === s.empresaId,
            ),
          ),
        ).toBe(true);
      }
  });
  it('inclui futuro, atraso, todos os estados finais e histórico com preço contratado distinto', () => {
    for (const group of seedPlan(now)) {
      expect(
        group.agendamentos.some(
          (a) => a.status === 'AGENDADO' && a.inicio > now,
        ),
      ).toBe(true);
      expect(
        group.agendamentos.some((a) => a.status === 'AGENDADO' && a.fim < now),
      ).toBe(true);
      expect(new Set(group.agendamentos.map((a) => a.status))).toEqual(
        new Set(['AGENDADO', 'CONCLUIDO', 'CANCELADO', 'FALTOU']),
      );
      const historic = group.agendamentos.find(
        (a) => a.status === 'CONCLUIDO',
      )!;
      expect(historic.servicos[0].precoCobrado).toBe('35.00');
      expect(
        group.servicos.find((s) => s.id === historic.servicos[0].servicoId)
          ?.preco,
      ).toBe('40.10');
    }
  });
  it('mantém a mesma chave durante o dia e muda os cenários no dia seguinte', () => {
    const first = seedPlan(now),
      same = seedPlan(new Date('2026-11-26T16:00:00Z')),
      next = seedPlan(new Date('2026-11-27T15:00:00Z'));
    const keys = (plan: ReturnType<typeof seedPlan>) =>
      plan.flatMap((g) => g.agendamentos.map((a) => a.chaveOperacao));
    expect(keys(first)).toEqual(keys(same));
    expect(keys(first).some((key) => keys(next).includes(key))).toBe(false);
    expect(new Set(keys(first)).size).toBe(12);
    expect(demoKey('exemplo')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
  it('usa o dia civil de cada empresa e reserva o horário futuro dentro do expediente', () => {
    const groups = seedPlan(new Date('2026-11-26T03:30:00Z'));
    expect(groups.map((g) => g.day)).toEqual(['2026-11-26', '2026-11-25']);
    const future = groups.map((g) =>
      g.agendamentos.find(
        (a) =>
          a.status === 'AGENDADO' &&
          a.inicio > new Date('2026-11-26T03:30:00Z'),
      )!,
    );
    expect(future.every((a) => a.fim > a.inicio)).toBe(true);
  });
  it('produz uma chave de replay compatível com a API e rejeita data inválida', () => {
    for (const group of seedPlan(now))
      for (const item of group.agendamentos) {
        const body = {
          clienteId: item.clienteId,
          profissionalId: item.profissionalId,
          servicoIds: item.servicos
            .map((s) => s.servicoId)
            .sort((a, b) => a - b),
          inicio: item.inicio.toISOString(),
        };
        expect(item.hashPedido).toBe(
          createHash('sha256').update(JSON.stringify(body)).digest('hex'),
        );
      }
    expect(() => seedPlan(new Date('inválida'))).toThrow('Data');
  });
});
