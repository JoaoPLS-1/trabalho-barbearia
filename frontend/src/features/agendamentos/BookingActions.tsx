import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage, ApiError } from '../../lib/api';
import type { Agendamento } from '../../lib/types';
import { useActiveCompany } from '../../app/company-context';
import { useUnsavedChanges } from '../../components/UnsavedChanges';
type FinalStatus = 'CONCLUIDO' | 'CANCELADO' | 'FALTOU';
const labels = {
  CONCLUIDO: 'Concluir atendimento',
  CANCELADO: 'Cancelar agendamento',
  FALTOU: 'Marcar falta',
};
export function BookingActions({
  item,
  onLocked,
  onUpdated,
}: {
  item: Agendamento;
  onLocked: (locked: boolean) => void;
  onUpdated: (item: Agendamento) => void;
}) {
  const company = useActiveCompany(),
    cache = useQueryClient();
  const [target, setTarget] = useState<FinalStatus | null>(null),
    [uncertain, setUncertain] = useState(false),
    [checked, setChecked] = useState(false),
    [message, setMessage] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  function updated(result: Agendamento) {
    onUpdated(result);
    void cache.invalidateQueries({ queryKey: ['empresa', company.id] });
  }
  const mutation = useMutation({
    mutationFn: (status: FinalStatus) =>
      api<Agendamento>('/agendamentos/' + item.id + '/status', {
        empresaId: company.id,
        method: 'PATCH',
        body: { status },
      }),
    onSuccess: (result) => {
      setUncertain(false);
      setTarget(null);
      setMessage('Situação atualizada.');
      updated(result);
    },
    onError: (error) => {
      setMessage(errorMessage(error));
      setUncertain(
        !(error instanceof ApiError) ||
          error.status === 0 ||
          error.status >= 500 ||
          error.code === 'OPERACAO_CONCORRENTE',
      );
      setChecked(false);
    },
  });
  const check = useMutation({
    mutationFn: () =>
      api<Agendamento>('/agendamentos/' + item.id, { empresaId: company.id }),
    onSuccess: (result) => {
      updated(result);
      setChecked(true);
      if (result.status !== 'AGENDADO') {
        setUncertain(false);
        setTarget(null);
        setMessage('A situação atual foi consultada.');
      } else
        setMessage(
          'O atendimento continua agendado. Você pode repetir a mesma ação.',
        );
    },
    onError: (error) => setMessage(errorMessage(error)),
  });
  const locked = mutation.isPending || check.isPending || uncertain;
  useEffect(() => {
    onLocked(locked);
    return () => onLocked(false);
  }, [locked, onLocked]);
  const guard = useUnsavedChanges(false, locked, {
    busyTitle: 'Atualização pendente',
    busyMessage:
      'Consulte a situação do atendimento antes de sair dos detalhes.',
  });
  return (
    <div className="booking-actions">
      {message && (
        <p role="status" className="form-note">
          {message}
        </p>
      )}
      {item.status === 'AGENDADO' && !target && (
        <>
          <h4>Resolver atendimento</h4>
          <div className="form-actions">
            {(Object.keys(labels) as FinalStatus[]).map((status) => (
              <button
                key={status}
                className="button secondary small"
                disabled={
                  status !== 'CANCELADO' && Date.parse(item.inicio) > now
                }
                onClick={() => {
                  setTarget(status);
                  setMessage('');
                  mutation.reset();
                }}
              >
                {labels[status]}
              </button>
            ))}
          </div>
          {Date.parse(item.inicio) > now && (
            <p className="details-note">
              Concluir e marcar falta ficam disponíveis a partir do início
              previsto. Você já pode cancelar.
            </p>
          )}
        </>
      )}
      {target && (
        <div className="finalization-confirm">
          <h4>{labels[target]}?</h4>
          <p>
            {target === 'CANCELADO'
              ? 'O horário será liberado e o registro continuará no histórico.'
              : target === 'FALTOU'
                ? 'O atendimento será registrado como falta e sairá das pendências.'
                : 'O atendimento será concluído e sairá das pendências.'}{' '}
            Esta decisão não pode ser desfeita pela recepção.
          </p>
          {uncertain && (
            <p role="alert">
              A resposta não foi confirmada. Consulte a situação antes de
              repetir a mesma ação.
            </p>
          )}
          <div className="form-actions">
            {!locked && (
              <button
                className="button secondary small"
                onClick={() => {
                  setTarget(null);
                  setMessage('');
                }}
              >
                Voltar aos detalhes
              </button>
            )}
            {uncertain && (
              <button
                className="button secondary small"
                disabled={mutation.isPending || check.isPending}
                onClick={() => check.mutate()}
              >
                Consultar situação
              </button>
            )}
            <button
              className="button small"
              disabled={
                mutation.isPending || check.isPending || (uncertain && !checked)
              }
              onClick={() => mutation.mutate(target)}
            >
              {mutation.isPending
                ? 'Atualizando…'
                : uncertain
                  ? 'Repetir a mesma ação'
                  : 'Confirmar ação'}
            </button>
          </div>
          {mutation.isError && !uncertain && (
            <button className="text-button" onClick={() => check.mutate()}>
              Atualizar situação do atendimento
            </button>
          )}
        </div>
      )}
      {guard.confirmation}
    </div>
  );
}
