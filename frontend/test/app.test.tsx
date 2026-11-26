import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient } from '@tanstack/react-query';
import { App } from '../src/app/App';
import { empresas, painel } from './fixtures';

const clients: QueryClient[] = [];
afterEach(() => {
  clients.forEach((client) => client.clear());
  clients.length = 0;
  vi.unstubAllGlobals();
});

function mockApi() {
  const mock = vi.fn(
    async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === '/empresas') return Response.json(empresas);
      if (url.pathname.startsWith('/empresas/'))
        return Response.json(
          empresas.find((e) => e.id === Number(url.pathname.split('/').at(-1))),
        );
      const empresaId = Number(
        new Headers(options?.headers).get('x-empresa-id'),
      );
      if (url.pathname === '/profissionais')
        return Response.json({ items: [], total: 0, page: 1, pageSize: 100 });
      if (url.pathname === '/agendamentos/pendentes')
        return Response.json(painel(empresaId));
      return Response.json({ message: 'Não encontrado' }, { status: 404 });
    },
  );
  vi.stubGlobal('fetch', mock);
  return mock;
}

function mount(path = '/') {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  clients.push(client);
  render(
    <MemoryRouter initialEntries={[path]}>
      <App queryClient={client} />
    </MemoryRouter>,
  );
  return client;
}

describe('Entrada e contexto de empresa', () => {
  it('exige seleção e não escolhe automaticamente a primeira empresa', async () => {
    mockApi();
    mount('/painel');
    await screen.findByRole('heading', { name: /Qual barbearia/ });
    expect(sessionStorage.getItem('barbearia.empresaId')).toBeNull();
    expect(
      screen.queryByRole('heading', { name: 'Painel da recepção' }),
    ).not.toBeInTheDocument();
  });

  it('abre a empresa escolhida, envia o contexto e mostra os indicadores da API', async () => {
    const fetchMock = mockApi();
    mount();
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Entrar na empresa Barbearia Centro',
      }),
    );
    await screen.findByRole('heading', { name: 'Painel da recepção' });
    await screen.findByText('Rafael Oliveira');
    expect(sessionStorage.getItem('barbearia.empresaId')).toBe('1');
    expect(
      screen.getByLabelText('Indicadores de atendimento'),
    ).toHaveTextContent('4');
    const call = fetchMock.mock.calls.find(([input]) =>
      String(input).includes('/agendamentos/pendentes'),
    );
    expect(new Headers(call?.[1]?.headers).get('x-empresa-id')).toBe('1');
  });

  it('permite pesquisar uma empresa sem alterar a seleção', async () => {
    mockApi();
    mount();
    await screen.findByRole('button', {
      name: 'Entrar na empresa Barbearia Centro',
    });
    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Buscar empresa' }),
      'Vila',
    );
    expect(
      screen.queryByRole('button', {
        name: 'Entrar na empresa Barbearia Centro',
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'Entrar na empresa Barbearia Vila Nova',
      }),
    ).toBeInTheDocument();
  });

  it('limpa o cache e a seleção ao alterar a empresa', async () => {
    mockApi();
    const client = mount();
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Entrar na empresa Barbearia Centro',
      }),
    );
    await screen.findByText('Rafael Oliveira');
    await userEvent.click(
      screen.getByRole('button', { name: 'Alterar empresa' }),
    );
    await screen.findByRole('heading', { name: /Qual barbearia/ });
    expect(sessionStorage.getItem('barbearia.empresaId')).toBeNull();
    expect(client.getQueriesData({ queryKey: ['empresa', 1] })).toHaveLength(0);
  });

  it('valida o contexto salvo e permite retomar o painel sem selecionar outra empresa', async () => {
    sessionStorage.setItem('barbearia.empresaId', '2');
    mockApi();
    mount('/painel');
    await screen.findByRole('heading', { name: 'Painel da recepção' });
    await waitFor(() =>
      expect(screen.getAllByText('Barbearia Vila Nova').length).toBeGreaterThan(
        0,
      ),
    );
  });

  it('trata falha de conexão com opção de tentar novamente', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    );
    mount();
    await screen.findByRole('heading', {
      name: 'Não foi possível carregar as empresas',
    });
    expect(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Failed to fetch')).not.toBeInTheDocument();
  });

  it('permite recuperar o painel após falha de leitura sem perder o filtro', async () => {
    const fetchMock = mockApi();
    mount();
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Entrar na empresa Barbearia Centro',
      }),
    );
    await screen.findByText('Rafael Oliveira');
    const input = screen.getByLabelText('Filtrar por data');
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url, options) =>
      String(url).includes('/agendamentos/pendentes')
        ? Response.json({ message: 'Serviço indisponível' }, { status: 503 })
        : original(url, options),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Hoje' }));
    await screen.findByRole('heading', {
      name: 'Não foi possível carregar os atendimentos',
    });
    expect(input).not.toHaveValue('');
  });
});
