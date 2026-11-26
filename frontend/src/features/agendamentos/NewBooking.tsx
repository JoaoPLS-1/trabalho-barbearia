import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, errorMessage } from '../../lib/api';
import { date, time, money, phone, today } from '../../lib/format';
import type { Agendamento, Page, Profissional } from '../../lib/types';
import { useActiveCompany } from '../../app/company-context';
import { StatePanel } from '../../components/StatePanel';
import { Dialog } from '../../components/Dialog';
import { useUnsavedChanges } from '../../components/UnsavedChanges';
import { allPages, type BookingService, type BookingClient } from './catalog';
import { Availability, useAvailability } from './Availability';
import {
  readOperation,
  saveOperation,
  clearOperation,
  matchesOperation,
  type BookingOperation,
} from './booking-operation';

export function NewBooking() {
  const company = useActiveCompany(),
    cache = useQueryClient();
  const [params] = useSearchParams();
  const [day, setDay] = useState(
    params.get('data') ?? today(company.fusoHorario),
  );
  const [professional, setProfessional] = useState(
    params.get('profissionalId') ?? '',
  );
  const [services, setServices] = useState<number[]>(() =>
    [
      ...new Set(
        (params.get('servicoIds') ?? '')
          .split(',')
          .filter((value) => /^[1-9]\d*$/.test(value))
          .map(Number),
      ),
    ].slice(0, 20),
  );
  const [slot, setSlot] = useState(params.get('inicio') ?? '');
  const [search, setSearch] = useState('');
  const [lookupSearch, setLookupSearch] = useState('');
  const [customerPage, setCustomerPage] = useState(1);
  const [customer, setCustomer] = useState<BookingClient | null>(null);
  const [quick, setQuick] = useState(false),
    [quickName, setQuickName] = useState(''),
    [quickPhone, setQuickPhone] = useState('');
  const [quickReviewed, setQuickReviewed] = useState(false);
  const [operation, setOperation] = useState<BookingOperation | null>(() =>
    readOperation(company.id),
  );
  const [receipt, setReceipt] = useState<Agendamento | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState('');
  const [notFound, setNotFound] = useState(false);
  const flight = useRef(false);
  const professionals = useQuery({
    queryKey: ['empresa', company.id, 'reserva-profissionais'],
    queryFn: ({ signal }) =>
      allPages<Profissional>('/profissionais?ativo=true', company.id, signal),
  });
  const catalog = useQuery({
    queryKey: ['empresa', company.id, 'reserva-servicos'],
    queryFn: ({ signal }) =>
      allPages<BookingService>('/servicos?ativo=true', company.id, signal),
  });
  const customers = useQuery({
    queryKey: [
      'empresa',
      company.id,
      'reserva-clientes',
      lookupSearch,
      customerPage,
    ],
    queryFn: ({ signal }) =>
      api<Page<BookingClient>>(
        '/clientes?' +
          new URLSearchParams({
            busca: lookupSearch,
            page: String(customerPage),
            pageSize: '10',
          }),
        { empresaId: company.id, signal },
      ),
  });
  const availability = useAvailability(
    day,
    professional,
    services,
    !operation && !receipt,
  );
  const quickMutation = useMutation({
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'TELEFONE_DUPLICADO') {
        setSearch(quickPhone);
        setLookupSearch(quickPhone);
        setCustomerPage(1);
      }
    },
    mutationFn: () =>
      api<BookingClient>('/clientes', {
        empresaId: company.id,
        method: 'POST',
        body: { nome: quickName.trim(), telefone: quickPhone },
      }),
    onSuccess: (item) => {
      setCustomer(item);
      setQuick(false);
      setQuickName('');
      setQuickPhone('');
      setQuickReviewed(false);
      void cache.invalidateQueries({
        queryKey: ['empresa', company.id, 'reserva-clientes'],
      });
    },
  });
  function finish(item: Agendamento) {
    clearOperation(company.id);
    setOperation(null);
    setReceipt(item);
    setConfirm(false);
    setMessage('');
    setNotFound(false);
    guard.allowLeave.current = true;
    void cache.invalidateQueries({ queryKey: ['empresa', company.id] });
  }
  const reserve = useMutation({
    mutationFn: (op: BookingOperation) =>
      api<Agendamento>('/agendamentos', {
        empresaId: op.empresaId,
        method: 'POST',
        body: op.body,
        idempotencyKey: op.key,
      }),
    onSuccess: finish,
    onError: (error) => {
      setConfirm(false);
      setMessage(errorMessage(error));
      const uncertain =
        !(error instanceof ApiError) ||
        error.status === 0 ||
        error.status >= 500 ||
        ['OPERACAO_CONCORRENTE', 'OPERACAO_DIVERGENTE'].includes(
          error.code ?? '',
        );
      if (!uncertain) {
        clearOperation(company.id);
        setOperation(null);
        if (
          error instanceof ApiError &&
          ['HORARIO_OCUPADO', 'FORA_EXPEDIENTE'].includes(error.code ?? '')
        ) {
          setSlot('');
          void availability.refetch();
        }
      }
    },
    onSettled: () => {
      flight.current = false;
    },
  });
  const lookup = useMutation({
    mutationFn: (op: BookingOperation) =>
      api<Agendamento>('/agendamentos/operacoes/' + op.key, {
        empresaId: op.empresaId,
      }),
    onSuccess: (item, op) => {
      if (matchesOperation(item, op)) finish(item);
      else
        setMessage(
          'O resultado encontrado não corresponde ao pedido salvo. Confira o atendimento na agenda antes de continuar.',
        );
    },
    onError: (error) => {
      setNotFound(error instanceof ApiError && error.status === 404);
      setMessage(
        error instanceof ApiError && error.status === 404
          ? 'A reserva ainda não foi encontrada. Você pode consultar novamente ou repetir o mesmo pedido com segurança.'
          : errorMessage(error),
      );
    },
  });
  const busy = reserve.isPending || lookup.isPending || quickMutation.isPending;
  const guard = useUnsavedChanges(
    !receipt &&
      (!!customer ||
        !!services.length ||
        !!slot ||
        !!quickName ||
        !!quickPhone),
    busy || !!operation,
    {
      busyTitle: 'Confirmação pendente',
      busyMessage:
        'Consulte o resultado da reserva antes de sair desta tela. O pedido permanece salvo nesta aba se você recarregar.',
    },
  );
  const validSlot = !!availability.data?.horarios.some(
    (value) => value.inicio === slot,
  );
  const validCatalog =
    !!catalog.data &&
    services.length > 0 &&
    services.every((id) => catalog.data.some((s) => s.id === id && s.ativo)) &&
    !!professionals.data?.some((p) => String(p.id) === professional && p.ativo);
  const canConfirm =
    !!customer &&
    validSlot &&
    validCatalog &&
    !availability.isFetching &&
    !availability.isError &&
    !busy &&
    !operation;
  function send() {
    if (flight.current || !canConfirm) return;
    const op: BookingOperation = {
      key: crypto.randomUUID(),
      empresaId: company.id,
      body: {
        clienteId: customer!.id,
        profissionalId: Number(professional),
        servicoIds: [...services].sort((a, b) => a - b),
        inicio: slot,
      },
    };
    try {
      saveOperation(op);
    } catch {
      setMessage(
        'O navegador não conseguiu guardar a confirmação. Habilite o armazenamento da sessão antes de reservar.',
      );
      setConfirm(false);
      return;
    }
    flight.current = true;
    setOperation(op);
    setNotFound(false);
    reserve.mutate(op);
  }
  function retry() {
    if (!operation || busy || flight.current) return;
    flight.current = true;
    setNotFound(false);
    reserve.mutate(operation);
  }
  const selectedServices =
    catalog.data?.filter((service) => services.includes(service.id)) ?? [];
  const quickUncertain =
    quickMutation.isError &&
    (!(quickMutation.error instanceof ApiError) ||
      quickMutation.error.status === 0 ||
      quickMutation.error.status >= 500);
  if (receipt)
    return (
      <>
        <header className="page-heading">
          <div>
            <span className="eyebrow">{company.nome}</span>
            <h1>Reserva confirmada</h1>
            <p>Atendimento #{receipt.id} registrado.</p>
          </div>
        </header>
        <section className="editor-card">
          <div className="form-body">
            <h2>{receipt.cliente.nome}</h2>
            <p>
              {date(receipt.inicio, company.fusoHorario)} ·{' '}
              {time(receipt.inicio, company.fusoHorario)} às{' '}
              {time(receipt.fim, company.fusoHorario)} ·{' '}
              {receipt.profissional.nome}
            </p>
            <ul className="service-list">
              {receipt.servicos.map((service) => (
                <li key={service.servicoId}>
                  <span>
                    {service.nomeContratado} · {service.duracaoContratadaMin}{' '}
                    min
                  </span>
                  <strong>{money(service.precoCobrado)}</strong>
                </li>
              ))}
            </ul>
            <p>
              Total confirmado: <strong>{money(receipt.total)}</strong>
            </p>
            <p>
              Situação:{' '}
              {receipt.status === 'AGENDADO'
                ? 'Agendado'
                : receipt.status === 'CONCLUIDO'
                  ? 'Concluído'
                  : receipt.status === 'CANCELADO'
                    ? 'Cancelado'
                    : 'Faltou'}
            </p>
            <div className="form-actions">
              <Link className="button secondary" to="/painel">
                Ir ao painel
              </Link>
              <Link className="button" to="/agendamentos">
                Ver agenda
              </Link>
              <button
                className="button secondary"
                onClick={() => {
                  setReceipt(null);
                  setSlot('');
                  setCustomer(null);
                  guard.allowLeave.current = false;
                  void availability.refetch();
                }}
              >
                Nova reserva
              </button>
            </div>
          </div>
        </section>
      </>
    );
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">AGENDAMENTOS · {company.nome}</span>
          <h1>Novo agendamento</h1>
          <p>
            Escolha o cliente, os serviços e um horário no fuso{' '}
            {company.fusoHorario}.
          </p>
        </div>
        <Link className="button secondary" to="/agendamentos">
          Ver agenda
        </Link>
      </header>
      {operation ? (
        <section className="editor-card">
          <div className="form-body">
            <h2>
              {busy
                ? 'Aguardando confirmação'
                : 'Conferir confirmação da reserva'}
            </h2>
            <p>
              Este pedido está protegido contra duplicidade. Consulte o
              resultado antes de iniciar outra reserva. Alterar os dados fica
              bloqueado até resolver a confirmação.
            </p>
            <p>
              Cliente #{operation.body.clienteId} · Profissional #
              {operation.body.profissionalId} ·{' '}
              {date(operation.body.inicio, company.fusoHorario)} às{' '}
              {time(operation.body.inicio, company.fusoHorario)}
            </p>
            {message && <p role="alert">{message}</p>}
            <div className="form-actions">
              <button
                className="button"
                disabled={busy}
                onClick={() => {
                  setMessage('');
                  setNotFound(false);
                  lookup.mutate(operation);
                }}
              >
                Consultar resultado
              </button>
              {notFound && (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={retry}
                >
                  Repetir o mesmo pedido
                </button>
              )}
            </div>
          </div>
        </section>
      ) : (
        <div className="booking-layout">
          <div className="booking-form">
            <section className="editor-card">
              <div className="editor-heading">
                <h2>1. Cliente</h2>
                <p>Busque um cadastro existente ou inclua um novo.</p>
              </div>
              <div className="form-body">
                {customer && (
                  <div className="selected-client">
                    <strong>Cliente selecionado: {customer.nome}</strong>
                    <span>{phone(customer.telefone)}</span>
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => setCustomer(null)}
                    >
                      Trocar cliente
                    </button>
                  </div>
                )}
                <form
                  className="client-search"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setLookupSearch(search.trim());
                    setCustomerPage(1);
                  }}
                >
                  <label className="form-field">
                    Buscar cliente por nome ou telefone
                    <input
                      type="search"
                      value={search}
                      maxLength={120}
                      disabled={busy}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>
                  <button className="button secondary" disabled={busy}>
                    Buscar cliente
                  </button>
                </form>
                {customers.isPending ? (
                  <StatePanel kind="loading" title="Buscando clientes" />
                ) : customers.isError ? (
                  <StatePanel
                    kind="error"
                    title="Não foi possível buscar clientes"
                    action={
                      <button
                        className="button secondary"
                        onClick={() => void customers.refetch()}
                      >
                        Tentar novamente
                      </button>
                    }
                  >
                    <p>{errorMessage(customers.error)}</p>
                  </StatePanel>
                ) : (
                  <>
                    <div
                      className="client-options"
                      role="group"
                      aria-label="Clientes encontrados"
                    >
                      {customers.data.items.map((item) => (
                        <button
                          className="client-option"
                          aria-pressed={customer?.id === item.id}
                          key={item.id}
                          disabled={busy}
                          onClick={() => setCustomer(item)}
                        >
                          <strong>{item.nome}</strong>
                          <span>{phone(item.telefone)}</span>
                        </button>
                      ))}
                      {!customers.data.items.length && (
                        <p>Nenhum cliente encontrado.</p>
                      )}
                    </div>
                    <div className="form-actions">
                      <button
                        className="button secondary small"
                        disabled={customerPage === 1 || busy}
                        onClick={() => setCustomerPage((p) => p - 1)}
                      >
                        Clientes anteriores
                      </button>
                      <span>Página {customerPage}</span>
                      <button
                        className="button secondary small"
                        disabled={
                          customerPage * 10 >= customers.data.total || busy
                        }
                        onClick={() => setCustomerPage((p) => p + 1)}
                      >
                        Próximos clientes
                      </button>
                    </div>
                  </>
                )}
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => setQuick((q) => !q)}
                >
                  {quick ? 'Fechar cadastro rápido' : 'Cadastrar cliente aqui'}
                </button>
                {quick && (
                  <form
                    className="quick-client"
                    noValidate
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (
                        !quickMutation.isPending &&
                        quickName.trim() &&
                        quickPhone.trim() &&
                        (!quickUncertain || quickReviewed)
                      )
                        quickMutation.mutate();
                    }}
                  >
                    <fieldset className="quick-fields" disabled={busy}>
                      <legend>Cadastro rápido</legend>
                      <label className="form-field">
                        Nome do novo cliente
                        <input
                          maxLength={120}
                          required
                          value={quickName}
                          onChange={(event) => {
                            setQuickName(event.target.value);
                            if (!quickUncertain) quickMutation.reset();
                          }}
                        />
                      </label>
                      <label className="form-field">
                        Telefone do novo cliente
                        <input
                          type="tel"
                          maxLength={25}
                          required
                          value={quickPhone}
                          aria-invalid={
                            !!(
                              quickMutation.error instanceof ApiError &&
                              quickMutation.error.fieldErrors?.telefone
                            )
                          }
                          onChange={(event) => {
                            setQuickPhone(event.target.value);
                            if (!quickUncertain) quickMutation.reset();
                          }}
                        />
                      </label>
                      {quickMutation.isError && (
                        <div role="alert" className="form-error">
                          <p>{errorMessage(quickMutation.error)}</p>
                          {quickMutation.error instanceof ApiError &&
                            quickMutation.error.fieldErrors?.telefone?.map(
                              (text) => <p key={text}>{text}</p>,
                            )}
                          {quickUncertain && (
                            <>
                              <p>
                                O cadastro pode ter sido gravado. Busque o
                                telefone antes de tentar novamente.
                              </p>
                              <button
                                type="button"
                                className="text-button"
                                onClick={() => {
                                  setSearch(quickPhone);
                                  setLookupSearch(quickPhone);
                                  setCustomerPage(1);
                                  void customers.refetch();
                                }}
                              >
                                Conferir telefone na busca
                              </button>
                              <button
                                type="button"
                                className="text-button"
                                onClick={() => setQuickReviewed(true)}
                              >
                                Conferi e quero tentar novamente
                              </button>
                            </>
                          )}
                        </div>
                      )}
                      <button
                        className="button secondary"
                        disabled={
                          !quickName.trim() ||
                          !quickPhone.trim() ||
                          busy ||
                          (quickUncertain && !quickReviewed)
                        }
                      >
                        {quickMutation.isPending
                          ? 'Salvando cliente…'
                          : 'Salvar e selecionar cliente'}
                      </button>
                    </fieldset>
                  </form>
                )}
              </div>
            </section>
            <section className="editor-card">
              <div className="editor-heading">
                <h2>2. Serviços e profissional</h2>
                <p>Selecione até 20 serviços ativos.</p>
              </div>
              <fieldset className="form-body" disabled={busy}>
                {catalog.isPending || professionals.isPending ? (
                  <StatePanel
                    kind="loading"
                    title="Carregando opções de reserva"
                  />
                ) : catalog.isError || professionals.isError ? (
                  <StatePanel
                    kind="error"
                    title="Não foi possível carregar as opções"
                    action={
                      <button
                        className="button secondary"
                        onClick={() => {
                          void catalog.refetch();
                          void professionals.refetch();
                        }}
                      >
                        Tentar novamente
                      </button>
                    }
                  />
                ) : (
                  <>
                    <div className="service-options">
                      {catalog.data
                        .filter((s) => s.ativo)
                        .map((service) => (
                          <label className="service-option" key={service.id}>
                            <input
                              type="checkbox"
                              checked={services.includes(service.id)}
                              disabled={
                                !services.includes(service.id) &&
                                services.length >= 20
                              }
                              onChange={(event) => {
                                setServices((current) =>
                                  event.target.checked
                                    ? [...current, service.id]
                                    : current.filter((id) => id !== service.id),
                                );
                                setSlot('');
                                setMessage('');
                              }}
                            />
                            <span>
                              <strong>{service.nome}</strong>
                              <small>
                                {service.duracaoMin} min ·{' '}
                                {money(service.preco)}
                              </small>
                            </span>
                          </label>
                        ))}
                      {!catalog.data.length && (
                        <p>
                          Nenhum serviço ativo. Cadastre ou ative um serviço
                          para agendar.
                        </p>
                      )}
                    </div>
                    <label className="form-field">
                      Profissional
                      <select
                        value={professional}
                        onChange={(event) => {
                          setProfessional(event.target.value);
                          setSlot('');
                          setMessage('');
                        }}
                      >
                        <option value="">Selecione o profissional</option>
                        {professionals.data
                          .filter((p) => p.ativo)
                          .map((item) => (
                            <option value={item.id} key={item.id}>
                              {item.nome}
                            </option>
                          ))}
                      </select>
                    </label>
                    {!professionals.data.length && (
                      <p>Nenhum profissional ativo nesta empresa.</p>
                    )}
                    <label className="form-field">
                      Data da reserva
                      <input
                        type="date"
                        min={today(company.fusoHorario)}
                        max="9999-12-31"
                        value={day}
                        onChange={(event) => {
                          setDay(event.target.value);
                          setSlot('');
                          setMessage('');
                        }}
                      />
                    </label>
                  </>
                )}
              </fieldset>
            </section>
            <section className="editor-card">
              <div className="form-body">
                <h2>3. Horário</h2>
                <Availability
                  query={availability}
                  selected={slot}
                  enabled={!!day && !!professional && !!services.length}
                  disabled={busy}
                  onSelect={setSlot}
                />
              </div>
            </section>
          </div>
          <aside className="booking-summary editor-card">
            <div className="form-body">
              <span className="eyebrow">SUA RESERVA</span>
              <h2>Revise antes de confirmar</h2>
              <p>{customer?.nome ?? 'Selecione um cliente'}</p>
              <ul>
                {selectedServices.map((service) => (
                  <li key={service.id}>
                    {service.nome} · {money(service.preco)}
                  </li>
                ))}
              </ul>
              <p>
                {professionals.data?.find((p) => String(p.id) === professional)
                  ?.nome ?? 'Selecione um profissional'}
              </p>
              <p>
                {day
                  ? day.split('-').reverse().join('/')
                  : 'Selecione uma data'}
                {slot
                  ? ' · ' + time(slot, company.fusoHorario)
                  : ' · Selecione um horário'}
              </p>
              {availability.data && !availability.isError && (
                <p>
                  Estimativa: <strong>{money(availability.data.total)}</strong>{' '}
                  · {availability.data.duracaoMin} min
                </p>
              )}
              {message && (
                <p className="form-error" role="alert">
                  {message}
                </p>
              )}
              <button
                className="button"
                disabled={!canConfirm}
                onClick={() => setConfirm(true)}
              >
                Revisar reserva
              </button>
              <p className="history-note">
                O horário só será reservado depois da confirmação.
              </p>
            </div>
          </aside>
        </div>
      )}
      {confirm && !operation && (
        <Dialog title="Confirmar reserva?" onClose={() => setConfirm(false)}>
          <div className="form-body">
            <p>
              <strong>{customer?.nome}</strong> ·{' '}
              {day.split('-').reverse().join('/')} às{' '}
              {time(slot, company.fusoHorario)}
            </p>
            <p>
              {selectedServices.map((s) => s.nome).join(' · ')} ·{' '}
              {availability.data && money(availability.data.total)}
            </p>
            <p>
              {company.nome} · {company.fusoHorario}
            </p>
            <div className="form-actions">
              <button
                className="button secondary"
                onClick={() => setConfirm(false)}
              >
                Voltar à reserva
              </button>
              <button className="button" disabled={!canConfirm} onClick={send}>
                Confirmar agendamento
              </button>
            </div>
          </div>
        </Dialog>
      )}
      {guard.confirmation}
    </>
  );
}
