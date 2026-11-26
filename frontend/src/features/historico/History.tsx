import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { date, money, time } from '../../lib/format';
import type { Agendamento, Page } from '../../lib/types';
import type { Cadastro } from '../cadastros/config';
import { useActiveCompany } from '../../app/company-context';
import { StatePanel } from '../../components/StatePanel';
import { BookingDetails } from '../dashboard/BookingDetails';

const labels = {
  AGENDADO: 'Agendado',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
  FALTOU: 'Faltou',
};
export function History() {
  const company = useActiveCompany();
  const { id } = useParams();
  const validId =
    !id || (/^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id)));
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const day = params.get('data') ?? '';
  const page = Math.max(
    1,
    Math.min(1000000, Math.trunc(Number(params.get('page')) || 1)),
  );
  const [details, setDetails] = useState<number | null>(null);
  const customer = useQuery({
    queryKey: ['empresa', company.id, 'clientes', 'detalhe', id],
    queryFn: ({ signal }) =>
      api<Cadastro>('/clientes/' + id, { empresaId: company.id, signal }),
    enabled: !!id && validId,
  });
  const queryParams = new URLSearchParams({
    page: String(page),
    pageSize: '10',
  });
  if (id) queryParams.set('clienteId', id);
  if (status) queryParams.set('status', status);
  if (day) queryParams.set('data', day);
  const query = useQuery({
    queryKey: ['empresa', company.id, 'historico', queryParams.toString()],
    queryFn: ({ signal }) =>
      api<Page<Agendamento>>('/agendamentos?' + queryParams, {
        empresaId: company.id,
        signal,
      }),
    enabled: validId && (!id || customer.isSuccess),
    staleTime: 0,
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
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">ATENDIMENTOS · {company.nome}</span>
          <h1>{id ? 'Histórico do cliente' : 'Histórico de atendimentos'}</h1>
          <p>
            {customer.data?.nome ??
              'Consulte reservas, serviços contratados e situações de atendimento.'}
          </p>
        </div>
        {id && (
          <Link className="button secondary" to="/clientes">
            Voltar aos clientes
          </Link>
        )}
      </header>
      <section className="appointments-panel">
        <div className="catalog-filters">
          <label>
            Situação do atendimento
            <select
              value={status}
              onChange={(event) => filter('status', event.target.value)}
            >
              <option value="">Todas as situações</option>
              {Object.entries(labels).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
          </label>
          <label>
            Data do atendimento
            <input
              type="date"
              value={day}
              min="1000-01-01"
              max="9999-12-31"
              onChange={(event) => filter('data', event.target.value)}
            />
          </label>
          {(status || day) && (
            <button className="text-button" onClick={() => setParams({})}>
              Limpar filtros
            </button>
          )}
        </div>
        <p className="history-note">
          Datas no fuso {company.fusoHorario}. Os valores e serviços abaixo são
          os registrados na reserva. Ordem do atendimento mais antigo ao mais
          recente.
        </p>
        {!validId ? (
          <StatePanel kind="error" title="Cliente inválido" />
        ) : id && customer.isError ? (
          <StatePanel
            kind="error"
            title="Não foi possível abrir o cliente"
            action={
              <button
                className="button"
                onClick={() => void customer.refetch()}
              >
                Tentar novamente
              </button>
            }
          >
            <p>{errorMessage(customer.error)}</p>
          </StatePanel>
        ) : query.isPending ? (
          <StatePanel kind="loading" title="Carregando histórico" />
        ) : query.isError ? (
          <StatePanel
            kind="error"
            title="Não foi possível carregar o histórico"
            action={
              <button className="button" onClick={() => void query.refetch()}>
                Tentar novamente
              </button>
            }
          >
            <p>{errorMessage(query.error)}</p>
          </StatePanel>
        ) : !query.data.items.length ? (
          <StatePanel
            title="Nenhum atendimento encontrado"
            action={
              page > 1 ? (
                <button
                  className="button secondary"
                  onClick={() => filter('page', '')}
                >
                  Voltar à primeira página
                </button>
              ) : undefined
            }
          >
            <p>
              {status || day
                ? 'Tente ajustar os filtros.'
                : 'Os atendimentos deste contexto aparecerão aqui.'}
            </p>
          </StatePanel>
        ) : (
          <>
            <ul className="history-list" aria-label="Atendimentos no histórico">
              {query.data.items.map((item) => (
                <li key={item.id}>
                  <div className="history-date">
                    <CalendarDays aria-hidden="true" />
                    <div>
                      <strong>{date(item.inicio, company.fusoHorario)}</strong>
                      <span>
                        {time(item.inicio, company.fusoHorario)} às{' '}
                        {time(item.fim, company.fusoHorario)}
                      </span>
                    </div>
                  </div>
                  <div className="history-person">
                    <h2>{item.cliente.nome}</h2>
                    <span>Com {item.profissional.nome}</span>
                    <p>
                      {item.servicos
                        .map((service) => service.nomeContratado)
                        .join(' · ')}
                    </p>
                  </div>
                  <div className="history-value">
                    <span className="badge neutral">{labels[item.status]}</span>
                    <strong>{money(item.total)}</strong>
                  </div>
                  <button
                    className="button secondary small"
                    onClick={() => setDetails(item.id)}
                  >
                    Ver detalhes
                    <span className="sr-only"> do atendimento {item.id}</span>
                  </button>
                </li>
              ))}
            </ul>
            <footer className="pagination">
              <span>
                {query.data.total} atendimento(s) · Página {page} de{' '}
                {Math.max(1, Math.ceil(query.data.total / 10))}
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
      {details !== null && (
        <BookingDetails id={details} onClose={() => setDetails(null)} />
      )}
    </>
  );
}
