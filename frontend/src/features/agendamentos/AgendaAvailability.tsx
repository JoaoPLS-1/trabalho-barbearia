import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useActiveCompany } from '../../app/company-context';
import { allPages, type BookingService } from './catalog';
import { Availability, useAvailability } from './Availability';
import { StatePanel } from '../../components/StatePanel';
import { money } from '../../lib/format';
export function AgendaAvailability({
  day,
  professional,
}: {
  day: string;
  professional: string;
}) {
  const company = useActiveCompany(),
    navigate = useNavigate();
  const [services, setServices] = useState<number[]>([]);
  const catalog = useQuery({
    queryKey: ['empresa', company.id, 'reserva-servicos'],
    queryFn: ({ signal }) =>
      allPages<BookingService>('/servicos?ativo=true', company.id, signal),
  });
  const query = useAvailability(day, professional, services);
  return (
    <section className="editor-card agenda-availability">
      <div className="editor-heading">
        <h2>Consultar horários livres</h2>
        <p>
          Escolha um profissional no filtro da agenda e os serviços abaixo.
          Clique em um horário para iniciar a reserva.
        </p>
      </div>
      <div className="form-body">
        {catalog.isPending ? (
          <StatePanel kind="loading" title="Carregando serviços" />
        ) : catalog.isError ? (
          <StatePanel
            kind="error"
            title="Não foi possível carregar serviços"
            action={
              <button
                className="button secondary"
                onClick={() => void catalog.refetch()}
              >
                Tentar novamente
              </button>
            }
          />
        ) : (
          <div className="service-options">
            {catalog.data.map((service) => (
              <label className="service-option" key={service.id}>
                <input
                  type="checkbox"
                  checked={services.includes(service.id)}
                  disabled={
                    !services.includes(service.id) && services.length >= 20
                  }
                  onChange={(event) =>
                    setServices((current) =>
                      event.target.checked
                        ? [...current, service.id]
                        : current.filter((id) => id !== service.id),
                    )
                  }
                />
                <span>
                  <strong>{service.nome}</strong>
                  <small>
                    {service.duracaoMin} min · {money(service.preco)}
                  </small>
                </span>
              </label>
            ))}
            {!catalog.data.length && <p>Nenhum serviço ativo nesta empresa.</p>}
          </div>
        )}
        <Availability
          query={query}
          selected=""
          enabled={!!professional && !!day && !!services.length}
          onSelect={(inicio) =>
            navigate(
              '/agendamentos/novo?' +
                new URLSearchParams({
                  data: day,
                  profissionalId: professional,
                  servicoIds: [...services].sort((a, b) => a - b).join(','),
                  inicio,
                }),
            )
          }
        />
      </div>
    </section>
  );
}
