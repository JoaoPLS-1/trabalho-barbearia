import { describe, expect, it, vi, afterEach } from 'vitest';
import { decimalPrice } from '../src/features/cadastros/config';
import { api } from '../src/lib/api';
afterEach(() => vi.unstubAllGlobals());

describe('Preço digitado na recepção', () => {
  it('normaliza centavos como texto, inclusive zeros e vírgula', () => {
    expect(decimalPrice('40,10')).toBe('40.10');
    expect(decimalPrice(' 0001,5 ')).toBe('1.50');
    expect(decimalPrice('0,01')).toBe('0.01');
    expect(decimalPrice('99999999.99')).toBe('99999999.99');
  });
  it('recusa frações extras, agrupamento, expoente, zero e excesso de valor', () => {
    for (const value of [
      '0',
      '0,00',
      '-1',
      '1,001',
      '1e2',
      '1.000,00',
      '100000000',
      '',
      'NaN',
    ])
      expect(decimalPrice(value)).toBeNull();
  });
});

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
