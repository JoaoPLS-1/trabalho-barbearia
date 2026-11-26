import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  ClipboardList,
  Clock3,
  ClockAlert,
  Filter,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import { api, ApiError, errorMessage } from '../../lib/api';
import { date, money, time, today } from '../../lib/format';
import type { Page, Pendentes, Profissional } from '../../lib/types';
import { useActiveCompany, useChangeCompany } from '../../app/company-context';
import { StatePanel } from '../../components/StatePanel';
import { BookingDetails } from './BookingDetails';

async function professionals(empresaId: number, signal: AbortSignal) {
  const first = await api<Page<Profissional>>(
    '/profissionais?page=1&pageSize=100',
    { empresaId, signal },
  );
  const items = [...first.items];
  for (let page = 2; page <= Math.ceil(first.total / 100); page++) {
    const result = await api<Page<Profissional>>(
      '/profissionais?page=' + page + '&pageSize=100',
      { empresaId, signal },
    );
    items.push(...result.items);
  }
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

export function Dashboard() {
  const company = useActiveCompany();
  const changeCompany = useChangeCompany();
  const [filters, setFilters] = useState({
    data: '',
    profissionalId: '',
    page: 1,
  });
  const [details, setDetails] = useState<number | null>(null);
  const catalog = useQuery({
    queryKey: ['empresa', company.id, 'profissionais'],
    queryFn: ({ signal }) => professionals(company.id, signal),
  });
  const query = useQuery({
    queryKey: ['empresa', company.id, 'pendentes', filters],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({
        page: String(filters.page),
        pageSize: '10',
      });
      if (filters.data) params.set('data', filters.data);
      if (filters.profissionalId)
        params.set('profissionalId', filters.profissionalId);
      return api<Pendentes>('/agendamentos/pendentes?' + params, {
        empresaId: company.id,
        signal,
      });
    },
    refetchInterval: 30000,
  });
  const companyUnavailable =
    query.error instanceof ApiError &&
    (query.error.code === 'EMPRESA_INATIVA' || query.error.status === 404);
  const result = companyUnavailable ? undefined : query.data;
  const pages = Math.max(1, Math.ceil((result?.total ?? 0) / 10));
  useEffect(() => {
    if (result && filters.page > pages)
      setFilters((current) => ({ ...current, page: pages }));
  }, [result, filters.page, pages]);
  const metrics = [
    {
      label: 'Pendentes de finalização',
      value: result?.resumo.pendentes,
      icon: ClipboardList,
      text: 'Todos os atendimentos em aberto',
      className: 'metric-pending',
    },
    {
      label: 'Agendados para hoje',
      value: result?.resumo.hoje,
      icon: CalendarDays,
      text: 'Pendências do dia na empresa',
      className: 'metric-today',
    },
    {
      label: 'Precisam de atenção',
      value: result?.resumo.atrasados,
      icon: ClockAlert,
      text: 'Horários encerrados sem finalização',
      className: 'metric-late',
    },
  ];

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">VISÃO GERAL</span>
          <h1>Painel da recepção</h1>
          <p>O próximo atendimento começa com uma agenda organizada.</p>
        </div>
        <button
          className="button secondary"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          <RefreshCw
            aria-hidden="true"
            className={query.isFetching ? 'spin' : undefined}
          />
          {query.isFetching ? 'Atualizando' : 'Atualizar painel'}
        </button>
      </header>
      <div className="metrics" aria-label="Indicadores de atendimento">
        {metrics.map(({ label, value, icon: Icon, text, className }) => (
          <section className={'metric ' + className} key={label}>
            <div className="metric-top">
              <span>{label}</span>
              <span className="metric-icon">
                <Icon aria-hidden="true" />
              </span>
            </div>
            <strong className="metric-value">{value ?? '—'}</strong>
            <p>{text}</p>
          </section>
        ))}
      </div>
      <p className="metrics-note">
        {filters.profissionalId
          ? 'Indicadores do profissional selecionado.'
          : 'Indicadores gerais da empresa.'}{' '}
        A data abaixo filtra apenas a lista.
      </p>
      <section
        className="appointments-panel"
        aria-labelledby="appointments-title"
      >
        <div className="panel-heading">
          <div>
            <h2 id="appointments-title">Agendamentos pendentes</h2>
            <p>Acompanhe os próximos horários e as pendências anteriores.</p>
          </div>
          <span className="count-label">
            {result
              ? result.total + ' em aberto'
              : query.isError
                ? 'Indisponível'
                : 'Consultando'}
          </span>
        </div>
        <div className="filter-bar">
          <span className="filter-caption">
            <SlidersHorizontal aria-hidden="true" />
            Filtrar por
          </span>
          <div className="filter-field">
            <label htmlFor="dashboard-data">Data</label>
            <span className="date-filter">
              <input
                id="dashboard-data"
                type="date"
                aria-label="Filtrar por data"
                value={filters.data}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    data: event.target.value,
                    page: 1,
                  }))
                }
              />
              <button
                type="button"
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    data: today(company.fusoHorario),
                    page: 1,
                  }))
                }
              >
                Hoje
              </button>
            </span>
          </div>
          <label>
            Profissional
            <span className="select-wrap">
              <select
                aria-label="Filtrar por profissional"
                value={filters.profissionalId}
                disabled={catalog.isPending || catalog.isError}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    profissionalId: event.target.value,
                    page: 1,
                  }))
                }
              >
                <option value="">Todos os profissionais</option>
                {catalog.data?.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                    {item.ativo ? '' : ' (inativo)'}
                  </option>
                ))}
              </select>
            </span>
          </label>
          {(filters.data || filters.profissionalId) && (
            <button
              className="text-button clear-filters"
              onClick={() =>
                setFilters({ data: '', profissionalId: '', page: 1 })
              }
            >
              Limpar filtros
            </button>
          )}
        </div>
        {catalog.isError && (
          <p className="inline-warning" role="alert">
            Não foi possível carregar os profissionais.{' '}
            <button
              className="text-button"
              onClick={() => void catalog.refetch()}
            >
              Tentar novamente
            </button>
          </p>
        )}
        {query.isError && result && (
          <div className="stale-notice" role="alert">
            Não foi possível atualizar. Os dados abaixo são da última consulta.{' '}
            <button
              className="text-button"
              onClick={() => void query.refetch()}
            >
              Tentar novamente
            </button>
          </div>
        )}
        {query.isPending ? (
          <StatePanel kind="loading" title="Carregando atendimentos">
            <p>Buscando as pendências desta empresa.</p>
          </StatePanel>
        ) : query.isError && !result ? (
          <StatePanel
            kind="error"
            title={
              companyUnavailable
                ? 'Empresa indisponível'
                : 'Não foi possível carregar os atendimentos'
            }
            action={
              companyUnavailable ? (
                <button className="button" onClick={changeCompany}>
                  Escolher outra empresa
                </button>
              ) : (
                <button className="button" onClick={() => void query.refetch()}>
                  Tentar novamente
                </button>
              )
            }
          >
            <p>{errorMessage(query.error)}</p>
          </StatePanel>
        ) : result?.items.length === 0 ? (
          <StatePanel
            title={
              filters.data || filters.profissionalId
                ? 'Nenhum atendimento com esses filtros'
                : 'Tudo em dia por aqui'
            }
            action={
              filters.data || filters.profissionalId ? (
                <button
                  className="button secondary"
                  onClick={() =>
                    setFilters({ data: '', profissionalId: '', page: 1 })
                  }
                >
                  Limpar filtros
                </button>
              ) : undefined
            }
          >
            <p>
              {filters.data || filters.profissionalId
                ? 'Experimente outra data ou profissional.'
                : 'Não há atendimentos pendentes de finalização nesta empresa.'}
            </p>
          </StatePanel>
        ) : (
          <>
            <div className="appointment-table-heading" aria-hidden="true">
              <span>Horário</span>
              <span>Cliente</span>
              <span>Profissional e serviços</span>
              <span>Valor</span>
              <span>Situação</span>
              <span />
            </div>
            <div className="appointments-list">
              {result?.items.map((item) => (
                <article
                  className={
                    'appointment-row ' + (item.atrasado ? 'is-late' : '')
                  }
                  key={item.id}
                  aria-label={'Atendimento de ' + item.cliente.nome}
                >
                  <div className="appointment-time">
                    <strong>
                      <Clock3 aria-hidden="true" />
                      {time(item.inicio, company.fusoHorario)}
                    </strong>
                    <span>{date(item.inicio, company.fusoHorario)}</span>
                  </div>
                  <div className="appointment-client">
                    <h3>{item.cliente.nome}</h3>
                    <span>Atendimento #{item.id}</span>
                  </div>
                  <div className="appointment-services">
                    <strong>{item.profissional.nome}</strong>
                    <span>
                      {item.servicos
                        .map((service) => service.nomeContratado)
                        .join(' + ')}{' '}
                      ·{' '}
                      {item.servicos.reduce(
                        (sum, service) => sum + service.duracaoContratadaMin,
                        0,
                      )}{' '}
                      min
                    </span>
                  </div>
                  <div className="appointment-price">
                    <span className="mobile-label">Valor</span>
                    <strong>{money(item.total)}</strong>
                  </div>
                  <span
                    className={
                      'badge ' + (item.atrasado ? 'late' : 'scheduled')
                    }
                  >
                    {item.atrasado ? 'Em atraso' : 'Agendado'}
                  </span>
                  <button
                    className="details-button"
                    onClick={() => setDetails(item.id)}
                    aria-label={
                      'Ver detalhes do atendimento de ' + item.cliente.nome
                    }
                  >
                    Ver detalhes
                  </button>
                </article>
              ))}
            </div>
          </>
        )}
        {result && result.total > 0 && (
          <div className="pagination">
            <p>
              {result.total}{' '}
              {result.total === 1
                ? 'atendimento encontrado'
                : 'atendimentos encontrados'}
            </p>
            <div>
              <button
                className="button secondary small"
                disabled={filters.page <= 1 || query.isFetching}
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    page: current.page - 1,
                  }))
                }
              >
                Anterior
              </button>
              <span>
                Página {Math.min(filters.page, pages)} de {pages}
              </span>
              <button
                className="button secondary small"
                disabled={filters.page >= pages || query.isFetching}
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    page: current.page + 1,
                  }))
                }
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </section>
      <p className="dashboard-note">
        <Filter aria-hidden="true" />
        Atendimentos antigos continuam aqui até que a recepção os finalize.
      </p>
      {details !== null && (
        <BookingDetails
          id={details}
          onClose={() => {
            setDetails(null);
            void query.refetch();
          }}
        />
      )}
    </>
  );
}
