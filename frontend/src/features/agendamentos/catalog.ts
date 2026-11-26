import { api } from '../../lib/api';
import type { Page } from '../../lib/types';
export interface BookingService {
  id: number;
  nome: string;
  preco: string;
  duracaoMin: number;
  ativo: boolean;
}
export interface BookingClient {
  id: number;
  nome: string;
  telefone: string;
}
export async function allPages<T extends { id: number }>(
  path: string,
  empresaId: number,
  signal: AbortSignal,
) {
  const items: T[] = [];
  for (let page = 1; ; page++) {
    const result = await api<Page<T>>(
      path + (path.includes('?') ? '&' : '?') + 'pageSize=100&page=' + page,
      { empresaId, signal },
    );
    items.push(...result.items);
    if (page * 100 >= result.total) break;
  }
  return [...new Map(items.map((item) => [item.id, item])).values()];
}
