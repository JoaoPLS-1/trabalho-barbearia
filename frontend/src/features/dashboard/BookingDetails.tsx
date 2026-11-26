import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Phone, UserRound } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { date, money, phone, time } from '../../lib/format';
import type { Agendamento } from '../../lib/types';
import { useActiveCompany } from '../../app/company-context';
import { Dialog } from '../../components/Dialog';
import { StatePanel } from '../../components/StatePanel';

const labels = {
  AGENDADO: 'Agendado',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
  FALTOU: 'Faltou',
};

export function BookingDetails({
  id,
  onClose,
}: {
  id: number;
  onClose: () => void;
}) {
  const company = useActiveCompany();
  const query = useQuery({
    queryKey: ['empresa', company.id, 'agendamento', id],
    queryFn: ({ signal }) =>
      api<Agendamento>('/agendamentos/' + id, {
        empresaId: company.id,
        signal,
      }),
    staleTime: 0,
  });
  const item = query.data;
  return (
    <Dialog title="Detalhes do atendimento" onClose={onClose}>
      {query.isPending ? (
        <StatePanel kind="loading" title="Carregando atendimento" />
      ) : query.isError ? (
        <StatePanel
          kind="error"
          title="Não foi possível abrir o atendimento"
          action={
            <button className="button" onClick={() => void query.refetch()}>
              Tentar novamente
            </button>
          }
        >
          <p>{errorMessage(query.error)}</p>
        </StatePanel>
      ) : (
        item && (
          <div className="booking-details">
            <div className="details-heading">
              <span className="eyebrow">ATENDIMENTO #{item.id}</span>
              <span className="badge neutral">{labels[item.status]}</span>
            </div>
            <h3>{item.cliente.nome}</h3>
            <p className="details-company">{company.nome}</p>
            <div className="details-facts">
              <p>
                <CalendarDays aria-hidden="true" />
                <span>
                  {date(item.inicio, company.fusoHorario)}
                  <strong>
                    {time(item.inicio, company.fusoHorario)} às{' '}
                    {time(item.fim, company.fusoHorario)}
                  </strong>
                </span>
              </p>
              <p>
                <UserRound aria-hidden="true" />
                <span>
                  Profissional<strong>{item.profissional.nome}</strong>
                </span>
              </p>
              <p>
                <Phone aria-hidden="true" />
                <a href={'tel:' + item.cliente.telefone.replace(/\D/g, '')}>
                  {phone(item.cliente.telefone)}
                </a>
              </p>
            </div>
            <h4>Serviços contratados</h4>
            <ul className="service-list">
              {item.servicos.map((service) => (
                <li key={service.servicoId}>
                  <div>
                    <strong>{service.nomeContratado}</strong>
                    <span>{service.duracaoContratadaMin} min</span>
                  </div>
                  <strong>{money(service.precoCobrado)}</strong>
                </li>
              ))}
            </ul>
            <div className="details-total">
              <span>Valor do atendimento</span>
              <strong>{money(item.total)}</strong>
            </div>
            {item.status === 'AGENDADO' && (
              <p className="details-note">
                Este atendimento ainda está pendente de finalização.
              </p>
            )}
          </div>
        )
      )}
    </Dialog>
  );
}
