import { useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '../../lib/api';
import { time, money } from '../../lib/format';
import { useActiveCompany } from '../../app/company-context';
import { StatePanel } from '../../components/StatePanel';
export interface AvailabilityResult {
  data: string;
  fusoHorario: string;
  profissionalId: number;
  duracaoMin: number;
  total: string;
  horarios: Array<{ inicio: string; fim: string }>;
}
export function useAvailability(
  day: string,
  professional: string,
  services: number[],
  enabled = true,
) {
  const company = useActiveCompany();
  const ids = [...services].sort((a, b) => a - b);
  return useQuery({
    queryKey: [
      'empresa',
      company.id,
      'disponibilidade',
      day,
      professional,
      ids,
    ],
    queryFn: ({ signal }) =>
      api<AvailabilityResult>(
        '/agendamentos/disponibilidade?' +
          new URLSearchParams({
            data: day,
            profissionalId: professional,
            servicoIds: ids.join(','),
          }),
        { empresaId: company.id, signal },
      ),
    enabled: enabled && !!day && !!professional && !!ids.length,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}
export function Availability({
  query,
  selected,
  onSelect,
  enabled,
  disabled = false,
}: {
  query: ReturnType<typeof useAvailability>;
  selected: string;
  onSelect: (value: string) => void;
  enabled: boolean;
  disabled?: boolean;
}) {
  if (!enabled)
    return (
      <StatePanel title="Escolha os serviços, o profissional e a data">
        <p>
          Os horários disponíveis serão consultados para a duração dos serviços.
        </p>
      </StatePanel>
    );
  if (query.isPending)
    return <StatePanel kind="loading" title="Consultando horários" />;
  if (query.isError)
    return (
      <StatePanel
        kind="error"
        title="Não foi possível consultar horários"
        action={
          <button
            type="button"
            className="button secondary"
            onClick={() => void query.refetch()}
          >
            Tentar novamente
          </button>
        }
      >
        <p>{errorMessage(query.error)}</p>
      </StatePanel>
    );
  return (
    <div className="availability">
      <div className="availability-heading">
        <div>
          <h3>Horários disponíveis</h3>
          <p>
            {query.data.duracaoMin} min · {money(query.data.total)} ·{' '}
            {query.data.fusoHorario}
          </p>
        </div>
        <button
          type="button"
          className="text-button"
          disabled={query.isFetching || disabled}
          onClick={() => {
            onSelect('');
            void query.refetch();
          }}
        >
          Atualizar horários
        </button>
      </div>
      <p className="form-note">
        A disponibilidade pode mudar até a confirmação. O preço e a duração
        serão conferidos novamente ao reservar.
      </p>
      {!query.data.horarios.length ? (
        <StatePanel title="Nenhum horário disponível">
          <p>Escolha outro dia ou profissional.</p>
        </StatePanel>
      ) : (
        <div
          className="slot-grid"
          role="group"
          aria-label="Horários disponíveis"
        >
          {query.data.horarios.map((slot) => (
            <button
              type="button"
              className={'slot ' + (selected === slot.inicio ? 'selected' : '')}
              aria-pressed={selected === slot.inicio}
              disabled={disabled || query.isFetching}
              key={slot.inicio}
              onClick={() => onSelect(slot.inicio)}
            >
              {time(slot.inicio, query.data.fusoHorario)}
              <span>até {time(slot.fim, query.data.fusoHorario)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
