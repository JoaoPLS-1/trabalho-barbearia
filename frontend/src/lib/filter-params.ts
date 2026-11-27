import { useCallback } from 'react';
import { useSearchParams, type SetURLSearchParams } from 'react-router-dom';

/** Conclui a navegação de um filtro antes do próximo evento de outro controle. */
export function useFilterParams() {
  const [params, setSearchParams] = useSearchParams();
  const setParams = useCallback<SetURLSearchParams>(
    (next, options) => setSearchParams(next, { ...options, flushSync: true }),
    [setSearchParams],
  );
  return [params, setParams] as const;
}
