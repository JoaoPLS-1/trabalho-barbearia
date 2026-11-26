import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Users, Scissors, UserRound } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { money, phone } from '../../lib/format';
import type { Page } from '../../lib/types';
import { useActiveCompany } from '../../app/company-context';
import { StatePanel } from '../../components/StatePanel';
import { cadastros, type Cadastro, type CadastroKind } from './config';

export function CadastroList({ kind }: { kind: CadastroKind }) {
  const company = useActiveCompany();
  const config = cadastros[kind];
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const search = params.get('busca') ?? '';
  const active = params.get('ativo') ?? '';
  const page = Math.max(
    1,
    Math.min(1000000, Math.trunc(Number(params.get('page')) || 1)),
  );
  const [draft, setDraft] = useState(search);
  useEffect(() => {
    setDraft(search);
  }, [search]);
  const queryParams = new URLSearchParams({
    page: String(page),
    pageSize: '10',
  });
  if (search) queryParams.set('busca', search);
  if (kind !== 'clientes' && ['true', 'false'].includes(active))
    queryParams.set('ativo', active);
  const query = useQuery({
    queryKey: ['empresa', company.id, kind, queryParams.toString()],
    queryFn: ({ signal }) =>
      api<Page<Cadastro>>('/' + kind + '?' + queryParams, {
        empresaId: company.id,
        signal,
      }),
  });
  function filter(key: string, value: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete('page');
      return next;
    });
  }
  const Icon =
    kind === 'clientes'
      ? Users
      : kind === 'profissionais'
        ? UserRound
        : Scissors;
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">CADASTROS · {company.nome}</span>
          <h1>{config.title}</h1>
          <p>{config.description}</p>
        </div>
        <Link className="button" to={'/' + kind + '/novo'}>
          <Plus aria-hidden="true" />
          {config.create}
        </Link>
      </header>
      {location.state?.notice && (
        <p className="save-notice" role="status">
          {location.state.notice}
        </p>
      )}
      <section className="appointments-panel">
        <form
          className="catalog-filters"
          onSubmit={(event) => {
            event.preventDefault();
            filter('busca', draft.trim());
          }}
        >
          <label className="catalog-search">
            <span>Buscar {config.singular}</span>
            <div>
              <Search aria-hidden="true" />
              <input
                type="search"
                value={draft}
                maxLength={120}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={kind === 'clientes' ? 'Nome ou telefone' : 'Nome'}
              />
            </div>
          </label>
          {kind !== 'clientes' && (
            <label>
              Situação
              <select
                value={active}
                onChange={(event) => filter('ativo', event.target.value)}
              >
                <option value="">Todas as situações</option>
                <option value="true">Ativos</option>
                <option value="false">Inativos</option>
              </select>
            </label>
          )}
          <button className="button secondary" type="submit">
            Buscar
          </button>
          {(search || active) && (
            <button
              className="text-button"
              type="button"
              onClick={() => {
                setDraft('');
                setParams({});
              }}
            >
              Limpar filtros
            </button>
          )}
        </form>
        {query.isPending ? (
          <StatePanel kind="loading" title="Carregando cadastros" />
        ) : query.isError ? (
          <StatePanel
            kind="error"
            title="Não foi possível carregar os cadastros"
            action={
              <button className="button" onClick={() => void query.refetch()}>
                Tentar novamente
              </button>
            }
          >
            <p>{errorMessage(query.error)}</p>
          </StatePanel>
        ) : query.data.items.length === 0 ? (
          <StatePanel
            title={
              search || active
                ? 'Nenhum resultado para estes filtros'
                : 'Nenhum cadastro por aqui'
            }
            action={
              page > 1 ? (
                <button
                  className="button secondary"
                  onClick={() =>
                    setParams((previous) => {
                      const next = new URLSearchParams(previous);
                      next.delete('page');
                      return next;
                    })
                  }
                >
                  Voltar à primeira página
                </button>
              ) : (
                <Link className="button secondary" to={'/' + kind + '/novo'}>
                  {config.create}
                </Link>
              )
            }
          >
            <p>
              {search || active
                ? 'Ajuste a busca ou a situação para tentar novamente.'
                : 'Comece pelo primeiro cadastro desta empresa.'}
            </p>
          </StatePanel>
        ) : (
          <>
            <ul className="catalog-list" aria-label={config.title}>
              {query.data.items.map((item) => (
                <li key={item.id}>
                  <div className="catalog-avatar">
                    <Icon aria-hidden="true" />
                  </div>
                  <div className="catalog-info">
                    <h2>{item.nome}</h2>
                    {kind === 'clientes' ? (
                      <span>{phone(item.telefone ?? '')}</span>
                    ) : (
                      <span
                        className={
                          'badge ' + (item.ativo ? 'success' : 'neutral')
                        }
                      >
                        {item.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    )}
                  </div>
                  {kind === 'servicos' && (
                    <div className="catalog-price">
                      <strong>{money(item.preco!)}</strong>
                      <span>{item.duracaoMin} min</span>
                    </div>
                  )}
                  <div className="catalog-actions">
                    {kind === 'clientes' && (
                      <Link
                        className="button secondary small"
                        to={'/clientes/' + item.id + '/historico'}
                      >
                        Histórico
                        <span className="sr-only"> de {item.nome}</span>
                      </Link>
                    )}
                    <Link
                      className="button secondary small"
                      to={'/' + kind + '/' + item.id + '/editar'}
                    >
                      Editar<span className="sr-only"> {item.nome}</span>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
            <footer className="pagination">
              <span>
                {query.data.total}{' '}
                {query.data.total === 1 ? 'cadastro' : 'cadastros'} · Página{' '}
                {page} de {Math.max(1, Math.ceil(query.data.total / 10))}
              </span>
              <div>
                <button
                  className="button secondary small"
                  disabled={page <= 1 || query.isFetching}
                  onClick={() =>
                    setParams((previous) => {
                      const next = new URLSearchParams(previous);
                      next.set('page', String(page - 1));
                      return next;
                    })
                  }
                >
                  Anterior
                </button>
                <button
                  className="button secondary small"
                  disabled={page * 10 >= query.data.total || query.isFetching}
                  onClick={() =>
                    setParams((previous) => {
                      const next = new URLSearchParams(previous);
                      next.set('page', String(page + 1));
                      return next;
                    })
                  }
                >
                  Próxima
                </button>
              </div>
            </footer>
          </>
        )}
      </section>
    </>
  );
}
