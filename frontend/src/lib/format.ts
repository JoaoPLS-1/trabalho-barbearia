export function money(value: string): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value));
}
export function time(value: string, zone: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: zone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
export function date(value: string, zone: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: zone,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}
export function today(zone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: string) =>
    parts.find((item) => item.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function cnpj(value: string): string {
  return value.length === 14
    ? `${value.slice(0, 2)}.${value.slice(2, 5)}.${value.slice(5, 8)}/${value.slice(8, 12)}-${value.slice(12)}`
    : value;
}
export function phone(value: string): string {
  return value.length === 11
    ? `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`
    : value.length === 10
      ? `(${value.slice(0, 2)}) ${value.slice(2, 6)}-${value.slice(6)}`
      : value;
}
