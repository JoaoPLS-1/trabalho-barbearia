import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, errorMessage } from '../../lib/api';
import { useActiveCompany } from '../../app/company-context';
import { StatePanel } from '../../components/StatePanel';
import { Dialog } from '../../components/Dialog';
import { useUnsavedChanges } from '../../components/UnsavedChanges';
import {
  cadastros,
  decimalPrice,
  type Cadastro,
  type CadastroKind,
} from './config';

type Values = {
  nome: string;
  telefone: string;
  preco: string;
  duracaoMin: string;
  ativo: boolean;
};
type Errors = Partial<Record<keyof Values, string>>;
const empty: Values = {
  nome: '',
  telefone: '',
  preco: '',
  duracaoMin: '30',
  ativo: true,
};

export function CadastroForm({ kind }: { kind: CadastroKind }) {
  const { id } = useParams();
  const company = useActiveCompany();
  const query = useQuery({
    queryKey: ['empresa', company.id, kind, 'detalhe', id],
    queryFn: ({ signal }) =>
      api<Cadastro>('/' + kind + '/' + id, { empresaId: company.id, signal }),
    enabled: id !== undefined && /^[1-9]\d*$/.test(id),
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  if (id && (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))))
    return <StatePanel kind="error" title="Cadastro inválido" />;
  if (id && query.isPending)
    return <StatePanel kind="loading" title="Carregando cadastro" />;
  if (id && query.isError)
    return (
      <StatePanel
        kind="error"
        title="Não foi possível abrir o cadastro"
        action={
          <button className="button" onClick={() => void query.refetch()}>
            Tentar novamente
          </button>
        }
      >
        <p>{errorMessage(query.error)}</p>
      </StatePanel>
    );
  return (
    <Editor key={kind + ':' + (id ?? 'novo')} kind={kind} item={query.data} />
  );
}

function Editor({ kind, item }: { kind: CadastroKind; item?: Cadastro }) {
  const company = useActiveCompany();
  const client = useQueryClient();
  const navigate = useNavigate();
  const config = cadastros[kind];
  const [initial] = useState<Values>(() =>
    item
      ? {
          nome: item.nome,
          telefone: item.telefone ?? '',
          preco: item.preco?.replace('.', ',') ?? '',
          duracaoMin: String(item.duracaoMin ?? 30),
          ativo: item.ativo ?? true,
        }
      : { ...empty },
  );
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [confirm, setConfirm] = useState(false);
  const [review, setReview] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const dirty = JSON.stringify(initial) !== JSON.stringify(values);
  const mutation = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { nome: values.nome.trim() };
      if (kind === 'clientes') body.telefone = values.telefone;
      if (kind === 'servicos') {
        body.preco = decimalPrice(values.preco);
        body.duracaoMin = Number(values.duracaoMin);
      }
      if (kind !== 'clientes' && item) body.ativo = values.ativo;
      return api<Cadastro>('/' + kind + (item ? '/' + item.id : ''), {
        empresaId: company.id,
        method: item ? 'PATCH' : 'POST',
        body,
      });
    },
    onSuccess: async () => {
      guard.allowLeave.current = true;
      await client.invalidateQueries({ queryKey: ['empresa', company.id] });
      navigate('/' + kind, {
        replace: true,
        state: { notice: 'Cadastro salvo com sucesso.' },
      });
    },
    onError: (error) => {
      setConfirm(false);
      if (error instanceof ApiError && error.fieldErrors) {
        const next: Errors = {};
        for (const key of Object.keys(initial) as (keyof Values)[]) {
          if (error.fieldErrors[key]?.[0])
            next[key] = error.fieldErrors[key][0];
        }
        setErrors(next);
      }
    },
  });
  useEffect(() => {
    if (!mutation.isPending && Object.values(errors).some(Boolean))
      form.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus();
  }, [errors, mutation.isPending]);
  const guard = useUnsavedChanges(dirty, mutation.isPending);
  // Consulta apenas indicativa: a desativação não cancela reservas existentes.
  const pending = useQuery({
    queryKey: ['empresa', company.id, 'pendencias-profissional', item?.id],
    queryFn: ({ signal }) =>
      api<{ total: number }>(
        '/agendamentos?profissionalId=' +
          item!.id +
          '&status=AGENDADO&pageSize=1',
        { empresaId: company.id, signal },
      ),
    enabled:
      confirm &&
      kind === 'profissionais' &&
      !!item &&
      item.ativo === true &&
      !values.ativo,
    staleTime: 0,
  });
  function change<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    mutation.reset();
    setReview(false);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (mutation.isPending) return;
    const next: Errors = {};
    if (!values.nome.trim()) next.nome = 'Informe o nome.';
    if (
      kind === 'clientes' &&
      (!/^[+\d().\s-]+$/.test(values.telefone) ||
        !/^(?:55)?\d{10,11}$/.test(values.telefone.replace(/\D/g, '')))
    )
      next.telefone =
        'Informe um telefone brasileiro com DDD (10 ou 11 dígitos).';
    if (kind === 'servicos') {
      if (!decimalPrice(values.preco))
        next.preco =
          'Informe um preço entre 0,01 e 99999999,99, com até duas casas decimais.';
      if (
        !/^\d+$/.test(values.duracaoMin) ||
        Number(values.duracaoMin) < 5 ||
        Number(values.duracaoMin) > 600
      )
        next.duracaoMin = 'Informe uma duração inteira entre 5 e 600 minutos.';
    }
    setErrors(next);
    if (Object.keys(next).length) {
      setTimeout(
        () =>
          form.current
            ?.querySelector<HTMLElement>('[aria-invalid="true"]')
            ?.focus(),
        0,
      );
      return;
    }
    if (item?.ativo && !values.ativo && kind !== 'clientes') {
      setConfirm(true);
      return;
    }
    mutation.mutate();
  }
  function field(
    key: 'nome' | 'telefone' | 'preco' | 'duracaoMin',
    label: string,
    options: {
      maxLength?: number;
      inputMode?: 'tel' | 'decimal' | 'numeric';
      hint?: string;
    } = {},
  ) {
    return (
      <label className="form-field" htmlFor={key}>
        <span>
          {label} <span aria-hidden="true">*</span>
        </span>
        <input
          id={key}
          name={key}
          value={values[key]}
          maxLength={options.maxLength}
          inputMode={options.inputMode}
          type={key === 'telefone' ? 'tel' : 'text'}
          aria-required="true"
          aria-invalid={!!errors[key]}
          aria-describedby={
            errors[key]
              ? key + '-error'
              : options.hint
                ? key + '-hint'
                : undefined
          }
          onChange={(event) => change(key, event.target.value)}
        />
        {errors[key] ? (
          <small className="field-error" id={key + '-error'}>
            {errors[key]}
          </small>
        ) : (
          options.hint && <small id={key + '-hint'}>{options.hint}</small>
        )}
      </label>
    );
  }
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">CADASTROS · {company.nome}</span>
          <h1>{item ? 'Editar ' + config.singular : config.create}</h1>
          <p>
            {item
              ? 'Atualize os dados sem perder o histórico de atendimentos.'
              : 'Preencha os campos para incluir um cadastro nesta empresa.'}
          </p>
        </div>
      </header>
      <form
        ref={form}
        className="editor-card"
        noValidate
        onSubmit={submit}
        aria-busy={mutation.isPending}
      >
        <div className="editor-heading">
          <h2>
            Dados{' '}
            {kind === 'clientes'
              ? 'do cliente'
              : kind === 'profissionais'
                ? 'do profissional'
                : 'do serviço'}
          </h2>
          <p>Os campos com * são obrigatórios.</p>
        </div>
        <fieldset className="form-body" disabled={mutation.isPending}>
          {field('nome', 'Nome', { maxLength: 120 })}
          {kind === 'clientes' &&
            field('telefone', 'Telefone com DDD', {
              maxLength: 25,
              inputMode: 'tel',
              hint: 'Ex.: (11) 99999-9999. O telefone identifica o cliente nesta empresa.',
            })}
          {kind === 'servicos' && (
            <div className="form-grid">
              {field('preco', 'Preço (R$)', {
                maxLength: 11,
                inputMode: 'decimal',
                hint: 'Ex.: 40,10',
              })}
              {field('duracaoMin', 'Duração (minutos)', {
                maxLength: 3,
                inputMode: 'numeric',
                hint: 'De 5 a 600 minutos.',
              })}
            </div>
          )}
          {item && kind !== 'clientes' && (
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={values.ativo}
                onChange={(event) => change('ativo', event.target.checked)}
              />
              <span>
                Disponível para novos agendamentos
                <small>
                  Desativar mantém o histórico e os agendamentos existentes.
                </small>
              </span>
            </label>
          )}
          {kind === 'servicos' && (
            <p className="form-note">
              Alterar o preço, nome ou duração afeta novas reservas. Os serviços
              já contratados mantêm os dados registrados no agendamento.
            </p>
          )}
          {mutation.isError && (
            <div className="form-error" role="alert">
              <p>{errorMessage(mutation.error)}</p>
              {(!(mutation.error instanceof ApiError) ||
                mutation.error.status === 0 ||
                mutation.error.status >= 500) && (
                <>
                  <p>
                    A gravação pode ter sido concluída. Consulte a lista antes
                    de enviar novamente.
                  </p>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setReview(true)}
                  >
                    Conferi a lista e quero tentar novamente
                  </button>
                  <Link
                    className="button secondary small"
                    to={'/' + kind}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Consultar cadastros em outra aba
                  </Link>
                </>
              )}
            </div>
          )}
          <div className="form-actions">
            <Link className="button secondary" to={'/' + kind}>
              Cancelar
            </Link>
            <button
              className="button"
              type="submit"
              disabled={
                mutation.isPending ||
                (!dirty && !!item) ||
                (mutation.isError &&
                  !review &&
                  (!(mutation.error instanceof ApiError) ||
                    mutation.error.status === 0 ||
                    mutation.error.status >= 500))
              }
            >
              {mutation.isPending ? 'Salvando…' : 'Salvar cadastro'}
            </button>
          </div>
        </fieldset>
      </form>
      {confirm && (
        <Dialog
          locked={mutation.isPending}
          title="Desativar cadastro?"
          onClose={() => {
            if (!mutation.isPending) setConfirm(false);
          }}
        >
          <div className="form-body">
            <p>
              <strong>{values.nome}</strong> deixará de aparecer nas opções de
              novos agendamentos. Os atendimentos existentes serão mantidos.
            </p>
            {kind === 'profissionais' &&
              (pending.isPending ? (
                <p role="status">Consultando reservas pendentes…</p>
              ) : pending.isError ? (
                <div role="alert">
                  <p>Não foi possível conferir as reservas.</p>
                  <button
                    className="button secondary"
                    onClick={() => void pending.refetch()}
                  >
                    Tentar novamente
                  </button>
                </div>
              ) : (
                <p>
                  {pending.data.total} atendimento(s) ainda agendado(s),
                  incluindo pendências antigas. A desativação não cancela esses
                  atendimentos; revise a agenda para organizar a equipe.
                </p>
              ))}
            <div className="form-actions">
              <button
                className="button secondary"
                disabled={mutation.isPending}
                onClick={() => setConfirm(false)}
              >
                Voltar
              </button>
              <button
                className="button"
                disabled={
                  mutation.isPending ||
                  (kind === 'profissionais' &&
                    (pending.isPending || pending.isError))
                }
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? 'Salvando…' : 'Confirmar desativação'}
              </button>
            </div>
          </div>
        </Dialog>
      )}
      {guard.confirmation}
    </>
  );
}
