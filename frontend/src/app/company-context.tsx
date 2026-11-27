import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { api, ApiError, errorMessage } from '../lib/api';
import type { Empresa } from '../lib/types';
import { StatePanel } from '../components/StatePanel';

const STORAGE_KEY = 'barbearia.empresaId';
function storedCompany(): number | null {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (!saved || !/^[1-9]\d*$/.test(saved)) return null;
    const id = Number(saved);
    return Number.isSafeInteger(id) && id <= 2147483647 ? id : null;
  } catch {
    return null;
  }
}
interface Selection {
  id: number | null;
  version: number;
}
const SelectionContext = createContext<{
  selection: Selection;
  choose: (id: number | null) => void;
} | null>(null);
const ActiveCompanyContext = createContext<Empresa | null>(null);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [selection, setSelection] = useState<Selection>(() => ({
    id: storedCompany(),
    version: 0,
  }));
  const location = useLocation();
  const previousPath = useRef(location.pathname);
  // Limpar somente depois de a navegação ser aceita pelo formulário.
  useEffect(() => {
    const changed = previousPath.current !== location.pathname;
    previousPath.current = location.pathname;
    if (changed && location.pathname === '/' && selection.id !== null)
      choose(null);
  }, [location.pathname, selection.id]);
  function choose(id: number | null) {
    // Cancelar antes de limpar; todos os fetches consomem o AbortSignal.
    void client.cancelQueries();
    client.clear();
    try {
      if (id === null) sessionStorage.removeItem(STORAGE_KEY);
      else sessionStorage.setItem(STORAGE_KEY, String(id));
    } catch {
      /* A seleção continua em memória quando o armazenamento é bloqueado. */
    }
    setSelection((current) => ({ id, version: current.version + 1 }));
  }
  return (
    <SelectionContext.Provider value={{ selection, choose }}>
      {children}
    </SelectionContext.Provider>
  );
}
export function useCompanySelection() {
  const context = useContext(SelectionContext);
  if (!context) throw new Error('Contexto de empresa indisponível.');
  return context;
}
export function useActiveCompany() {
  const company = useContext(ActiveCompanyContext);
  if (!company) throw new Error('Selecione uma empresa para continuar.');
  return company;
}
export function useChangeCompany() {
  const navigate = useNavigate();
  return () => {
    navigate('/', { replace: true });
  };
}

export function CompanyGate() {
  const { selection } = useCompanySelection();
  const change = useChangeCompany();
  const company = useQuery({
    queryKey: ['empresa', selection.id],
    queryFn: ({ signal }) =>
      api<Empresa>('/empresas/' + selection.id, { signal }),
    enabled: selection.id !== null,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  if (selection.id === null) return <Navigate to="/" replace />;
  if (company.isPending)
    return (
      <main className="gate">
        <StatePanel
          kind="loading"
          title="Abrindo a recepção"
          action={
            <button className="button secondary" onClick={change}>
              Escolher outra empresa
            </button>
          }
        >
          <p>Conferindo a empresa selecionada.</p>
        </StatePanel>
      </main>
    );
  if (company.isError)
    return (
      <main className="gate">
        <StatePanel
          kind="error"
          title="Não foi possível abrir esta empresa"
          action={
            <>
              <button className="button" onClick={() => void company.refetch()}>
                Tentar novamente
              </button>
              <button className="button secondary" onClick={change}>
                Escolher outra empresa
              </button>
            </>
          }
        >
          <p>
            {company.error instanceof ApiError && company.error.status === 404
              ? 'Esta empresa não está mais disponível.'
              : errorMessage(company.error)}
          </p>
        </StatePanel>
      </main>
    );
  if (!company.data.ativa || company.data.id !== selection.id)
    return (
      <main className="gate">
        <StatePanel
          kind="error"
          title="Empresa indisponível"
          action={
            <button className="button" onClick={change}>
              Escolher outra empresa
            </button>
          }
        >
          <p>Selecione uma empresa ativa para continuar o atendimento.</p>
        </StatePanel>
      </main>
    );
  return (
    <ActiveCompanyContext.Provider value={company.data}>
      <Outlet key={selection.id + ':' + selection.version} />
    </ActiveCompanyContext.Provider>
  );
}
