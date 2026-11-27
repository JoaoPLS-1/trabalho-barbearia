export function normalizarNome(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export function normalizarTelefone(value: unknown): unknown {
  if (typeof value !== 'string' || !/^[\d\s()+.-]+$/.test(value)) return value;
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('55') && [12, 13].includes(digits.length)
    ? digits.slice(2)
    : digits;
}
