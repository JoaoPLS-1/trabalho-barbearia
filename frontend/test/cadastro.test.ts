import { describe, expect, it, vi, afterEach } from 'vitest';
import { api } from '../src/lib/api';
afterEach(() => vi.unstubAllGlobals());

describe('Validação por campo na API', () => {
  it('preserva o erro de telefone duplicado e envia a gravação no contexto selecionado', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json(
          {
            message: 'Telefone já cadastrado nesta empresa.',
            code: 'TELEFONE_DUPLICADO',
            fieldErrors: {
              telefone: ['Use o cadastro existente ou informe outro telefone.'],
              nome: 'inválido',
            },
          },
          { status: 409 },
        ),
      );
    vi.stubGlobal('fetch', fetch);
    await expect(
      api('/clientes', {
        empresaId: 2,
        method: 'POST',
        body: { nome: 'Ana', telefone: '11999999999' },
      }),
    ).rejects.toMatchObject({
      status: 409,
      fieldErrors: {
        telefone: ['Use o cadastro existente ou informe outro telefone.'],
      },
    });
    expect(
      new Headers(fetch.mock.calls[0][1].headers).get('x-empresa-id'),
    ).toBe('2');
    expect(fetch.mock.calls[0][1].method).toBe('POST');
  });
});
