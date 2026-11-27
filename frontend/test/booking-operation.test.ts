import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  readOperation,
  saveOperation,
  clearOperation,
  matchesOperation,
  type BookingOperation,
} from '../src/features/agendamentos/booking-operation';
import { api } from '../src/lib/api';
import { agendamento } from './fixtures';
const op: BookingOperation = {
  key: '550e8400-e29b-41d4-a716-446655440000',
  empresaId: 1,
  body: {
    clienteId: 11,
    profissionalId: 7,
    servicoIds: [9],
    inicio: agendamento.inicio,
  },
};
afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});
describe('Recuperação da confirmação', () => {
  it('mantém a chave e o pedido após retomar a tela, isolados por empresa', () => {
    saveOperation(op);
    expect(readOperation(1)).toEqual(op);
    expect(readOperation(2)).toBeNull();
    clearOperation(1);
    expect(readOperation(1)).toBeNull();
  });
  it('não recupera JSON inválido, chave inválida ou IDs de empresa divergente', () => {
    for (const value of [
      '{',
      JSON.stringify({ ...op, key: 'inválida' }),
      JSON.stringify({ ...op, empresaId: 2 }),
      JSON.stringify({ ...op, body: { ...op.body, servicoIds: [9, 9] } }),
    ]) {
      sessionStorage.setItem('barbearia.reserva.1', value);
      expect(readOperation(1)).toBeNull();
    }
  });
  it('confere o pedido encontrado e aceita resultado já finalizado', () => {
    expect(matchesOperation(agendamento, op)).toBe(true);
    expect(matchesOperation({ ...agendamento, status: 'CONCLUIDO' }, op)).toBe(
      true,
    );
    expect(matchesOperation({ ...agendamento, empresaId: 2 }, op)).toBe(false);
    expect(
      matchesOperation(
        { ...agendamento, cliente: { ...agendamento.cliente, id: 100 } },
        op,
      ),
    ).toBe(false);
    expect(matchesOperation({ ...agendamento, servicos: [] }, op)).toBe(false);
  });
  it('envia o mesmo header e corpo em repetições explícitas, sem repetir automaticamente', async () => {
    const fetch = vi
      .fn()
      .mockImplementation(() => Promise.resolve(Response.json(agendamento)));
    vi.stubGlobal('fetch', fetch);
    for (let i = 0; i < 2; i++)
      await api('/agendamentos', {
        empresaId: 1,
        method: 'POST',
        body: op.body,
        idempotencyKey: op.key,
      });
    expect(fetch).toHaveBeenCalledTimes(2);
    for (const [, options] of fetch.mock.calls) {
      expect(new Headers(options.headers).get('Idempotency-Key')).toBe(op.key);
      expect(JSON.parse(options.body)).toEqual(op.body);
    }
  });
});
