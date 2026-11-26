import type { Agendamento } from '../../lib/types';
export interface BookingRequest {
  clienteId: number;
  profissionalId: number;
  servicoIds: number[];
  inicio: string;
}
export interface BookingOperation {
  key: string;
  empresaId: number;
  body: BookingRequest;
}
const storageKey = (empresaId: number) => 'barbearia.reserva.' + empresaId;
export function readOperation(empresaId: number): BookingOperation | null {
  try {
    const value: unknown = JSON.parse(
      sessionStorage.getItem(storageKey(empresaId)) ?? 'null',
    );
    if (!value || typeof value !== 'object') return null;
    const op = value as BookingOperation;
    const positive = (id: unknown) =>
      typeof id === 'number' &&
      Number.isInteger(id) &&
      id > 0 &&
      id <= 2147483647;
    if (
      op.empresaId !== empresaId ||
      typeof op.key !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        op.key,
      ) ||
      !op.body ||
      !positive(op.body.clienteId) ||
      !positive(op.body.profissionalId) ||
      !Array.isArray(op.body.servicoIds) ||
      !op.body.servicoIds.length ||
      op.body.servicoIds.length > 20 ||
      !op.body.servicoIds.every(positive) ||
      new Set(op.body.servicoIds).size !== op.body.servicoIds.length ||
      typeof op.body.inicio !== 'string' ||
      !Number.isFinite(Date.parse(op.body.inicio))
    )
      return null;
    return op;
  } catch {
    return null;
  }
}
export function saveOperation(operation: BookingOperation) {
  // Persistir antes do envio permite recuperar a consulta após recarregar.
  sessionStorage.setItem(
    storageKey(operation.empresaId),
    JSON.stringify(operation),
  );
}
export function clearOperation(empresaId: number) {
  try {
    sessionStorage.removeItem(storageKey(empresaId));
  } catch {
    /* O replay da operação salva continua seguro. */
  }
}
export function matchesOperation(
  item: Agendamento,
  operation: BookingOperation,
) {
  return (
    item.empresaId === operation.empresaId &&
    item.cliente.id === operation.body.clienteId &&
    item.profissional.id === operation.body.profissionalId &&
    Date.parse(item.inicio) === Date.parse(operation.body.inicio) &&
    item.servicos
      .map((s) => s.servicoId)
      .sort((a, b) => a - b)
      .join(',') ===
      [...operation.body.servicoIds].sort((a, b) => a - b).join(',')
  );
}
