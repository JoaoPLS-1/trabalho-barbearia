import { useCallback, useLayoutEffect, useRef } from 'react';
import {
  createSearchParams,
  useLocation,
  useNavigationType,
  useSearchParams,
  type SetURLSearchParams,
} from 'react-router-dom';

/** Eventos rápidos e callbacks anteriores devem compor o último filtro solicitado. */
export function useFilterParams() {
  const [params, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigationType = useNavigationType();
  const latest = useRef(new URLSearchParams(params));
  const pending = useRef<string | null>(null);
  const pathname = useRef(location.pathname);
  const navigate = useRef(setSearchParams);

  useLayoutEffect(() => {
    navigate.current = setSearchParams;
    // Ignorar commits intermediários de uma sequência de navegações próprias.
    // Voltar/avançar e mudar de página sempre passam a ser a origem dos filtros.
    if (
      pathname.current !== location.pathname ||
      navigationType === 'POP' ||
      pending.current === null ||
      pending.current === params.toString()
    ) {
      latest.current = new URLSearchParams(params);
      pending.current = null;
    }
    pathname.current = location.pathname;
  }, [
    params,
    setSearchParams,
    location.key,
    location.pathname,
    navigationType,
  ]);

  const setParams = useCallback<SetURLSearchParams>((next, options) => {
    const updated = createSearchParams(
      typeof next === 'function'
        ? next(new URLSearchParams(latest.current))
        : next,
    );
    latest.current = updated;
    pending.current = updated.toString();
    navigate.current(updated, options);
  }, []);

  return [params, setParams] as const;
}
