import { Component, useState, type ErrorInfo, type ReactNode } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { createQueryClient } from '../lib/query';
import { CompanyGate, CompanyProvider } from './company-context';
import { CompanyChoice } from '../features/empresas/CompanyChoice';
import { Dashboard } from '../features/dashboard/Dashboard';
import { CadastroList } from '../features/cadastros/CadastroList';
import { CadastroForm } from '../features/cadastros/CadastroForm';
import { Shell } from './Shell';
import { StatePanel } from '../components/StatePanel';

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Falha ao abrir a tela.', error, info.componentStack);
  }
  render() {
    return this.state.failed ? (
      <main className="gate">
        <StatePanel
          kind="error"
          title="Não foi possível abrir esta tela"
          action={
            <button className="button" onClick={() => window.location.reload()}>
              Recarregar página
            </button>
          }
        >
          <p>Tente recarregar para continuar o atendimento.</p>
        </StatePanel>
      </main>
    ) : (
      this.props.children
    );
  }
}

function PendingArea({ title }: { title: string }) {
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">RECEPÇÃO</span>
          <h1>{title}</h1>
        </div>
      </header>
      <section className="appointments-panel">
        <StatePanel
          title="Área em preparação"
          action={
            <Link className="button" to="/painel">
              Voltar ao painel
            </Link>
          }
        >
          <p>
            Enquanto esta área é preparada, você pode acompanhar os atendimentos
            no painel.
          </p>
        </StatePanel>
      </section>
    </>
  );
}
const areas = [
  ['/clientes/:id/historico', 'Histórico do cliente'],
  ['/agendamentos/historico', 'Histórico de atendimentos'],
  ['/servicos', 'Serviços'],
  ['/servicos/novo', 'Novo serviço'],
  ['/agendamentos', 'Agenda'],
  ['/agendamentos/novo', 'Novo agendamento'],
];

export function App({ queryClient }: { queryClient?: QueryClient }) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  return (
    <QueryClientProvider client={client}>
      <CompanyProvider>
        <AppErrorBoundary>
          <a className="skip-link" href="#conteudo">
            Ir para o conteúdo
          </a>
          <Routes>
            <Route path="/" element={<CompanyChoice />} />
            <Route element={<CompanyGate />}>
              <Route element={<Shell />}>
                <Route path="/painel" element={<Dashboard />} />
                {(['clientes', 'profissionais'] as const).map(
                  (kind) => (
                    <Route key={kind}>
                      <Route
                        path={'/' + kind}
                        element={<CadastroList kind={kind} />}
                      />
                      <Route
                        path={'/' + kind + '/novo'}
                        element={<CadastroForm kind={kind} />}
                      />
                      <Route
                        path={'/' + kind + '/:id/editar'}
                        element={<CadastroForm kind={kind} />}
                      />
                    </Route>
                  ),
                )}
                {areas.map(([path, title]) => (
                  <Route
                    key={path}
                    path={path}
                    element={<PendingArea title={title} />}
                  />
                ))}
                <Route
                  path="*"
                  element={<PendingArea title="Página não encontrada" />}
                />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppErrorBoundary>
      </CompanyProvider>
    </QueryClientProvider>
  );
}
