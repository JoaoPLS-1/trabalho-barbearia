import { useState, type ReactNode } from 'react';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { useFilterParams } from '../src/lib/filter-params';

function Filters() {
  const [params, setParams] = useFilterParams();
  return (
    <>
      <label>
        Situação
        <select
          value={params.get('status') ?? ''}
          onChange={(event) =>
            setParams((previous) => {
              const next = new URLSearchParams(previous);
              next.set('status', event.target.value);
              next.delete('page');
              return next;
            })
          }
        >
          <option value="">Todas</option>
          <option value="CANCELADO">Cancelado</option>
          <option value="AGENDADO">Agendado</option>
        </select>
      </label>
      <label>
        Data
        <input
          type="date"
          value={params.get('data') ?? ''}
          onChange={(event) =>
            setParams((previous) => {
              const next = new URLSearchParams(previous);
              next.set('data', event.target.value);
              next.delete('page');
              return next;
            })
          }
        />
      </label>
      <button onClick={() => setParams({})}>Limpar filtros</button>
    </>
  );
}
function mount() {
  const router = createMemoryRouter([{ path: '/', element: <Filters /> }], {
    initialEntries: ['/?status=CANCELADO&page=3'],
  });
  render(<RouterProvider router={router} />);
  return router;
}
describe('Filtros da URL', () => {
  it('limpar e preencher data em sequência não restaura a situação anterior', () => {
    const router = mount();
    const clear = screen.getByRole('button', { name: 'Limpar filtros' });
    const day = screen.getByLabelText('Data');
    // Dois eventos antes do próximo frame, como um uso rápido dos controles.
    act(() => {
      clear.click();
      fireEvent.change(day, { target: { value: '2030-01-07' } });
    });
    expect(
      new URLSearchParams(router.state.location.search).get('status'),
    ).toBeNull();
    expect(screen.getByLabelText('Situação')).toHaveValue('');
    expect(screen.getByLabelText('Data')).toHaveValue('2030-01-07');
  });
  it('alterar uma data preserva a situação, reinicia a página e permite voltar', async () => {
    const router = mount();
    fireEvent.change(screen.getByLabelText('Data'), {
      target: { value: '2030-01-07' },
    });
    const params = new URLSearchParams(router.state.location.search);
    expect(params.get('status')).toBe('CANCELADO');
    expect(params.has('page')).toBe(false);
    await act(async () => {
      await router.navigate(-1);
    });
    expect(screen.getByLabelText('Data')).toHaveValue('');
    expect(new URLSearchParams(router.state.location.search).get('page')).toBe(
      '3',
    );
  });
});

it('callback anterior à limpeza também parte dos filtros mais recentes', () => {
  function Wrapper({ children }: { children: ReactNode }) {
    const [router] = useState(() =>
      createMemoryRouter([{ path: '/', element: children }], {
        initialEntries: ['/?status=CANCELADO&page=3'],
      }),
    );
    return <RouterProvider router={router} />;
  }
  const { result } = renderHook(() => useFilterParams(), { wrapper: Wrapper });
  const previousSetter = result.current[1];
  act(() => result.current[1]({}));
  act(() =>
    previousSetter((previous) => {
      const next = new URLSearchParams(previous);
      next.set('data', '2030-01-07');
      return next;
    }),
  );
  expect(result.current[0].get('status')).toBeNull();
  expect(result.current[0].get('data')).toBe('2030-01-07');
});
