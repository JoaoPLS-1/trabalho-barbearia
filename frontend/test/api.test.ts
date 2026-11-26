import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../src/lib/api';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Cliente HTTP', () => {
  it('envia contexto explicitamente e permite seleção sem header de empresa', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(
        () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);
    await api('/clientes', { empresaId: 2 });
    expect(
      new Headers(fetchMock.mock.calls[0][1].headers).get('x-empresa-id'),
    ).toBe('2');
    await api('/empresas?ativa=true');
    expect(
      new Headers(fetchMock.mock.calls[1][1].headers).has('x-empresa-id'),
    ).toBe(false);
  });

  it('preserva mensagens e códigos úteis da API', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              code: 'EMPRESA_INATIVA',
              message: 'Empresa inativa.',
            }),
            { status: 400 },
          ),
        ),
    );
    await expect(api('/clientes', { empresaId: 1 })).rejects.toMatchObject({
      status: 400,
      code: 'EMPRESA_INATIVA',
      message: 'Empresa inativa.',
    });
  });

  it('não apresenta HTML de um serviço indisponível como mensagem', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('<html>Erro do proxy</html>', { status: 502 }),
        ),
    );
    await expect(api('/clientes')).rejects.toMatchObject({
      status: 502,
      message: 'Não foi possível concluir a consulta. Tente novamente.',
    });
  });

  it('recusa JSON inválido em resposta de sucesso', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('invalido', { status: 200 })),
    );
    await expect(api('/clientes')).rejects.toMatchObject({ status: 502 });
  });

  it('repassa cancelamento de consultas ao fetch', async () => {
    const signal = new AbortController();
    let received: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            received = options.signal;
            options.signal.addEventListener('abort', () =>
              reject(new DOMException('Cancelado', 'AbortError')),
            );
          }),
      ),
    );
    const pending = api('/clientes', { signal: signal.signal });
    const check = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    signal.abort();
    await check;
    expect(received?.aborted).toBe(true);
  });

  it('explica timeout e encerra o pedido', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            options.signal.addEventListener('abort', () =>
              reject(new DOMException('Cancelado', 'AbortError')),
            );
          }),
      ),
    );
    const check = expect(
      api('/clientes', { timeoutMs: 10 }),
    ).rejects.toBeInstanceOf(ApiError);
    await vi.advanceTimersByTimeAsync(11);
    await check;
  });
});
