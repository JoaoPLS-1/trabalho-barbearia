import { corsOrigins } from './configure-app.js';

describe('Origens do front-end', () => {
  it('permite as duas origens locais por padrão', () => {
    expect(corsOrigins()).toEqual([
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ]);
  });

  it('normaliza espaços e remove duplicatas', () => {
    expect(
      corsOrigins('https://recepcao.example, https://recepcao.example'),
    ).toEqual(['https://recepcao.example']);
  });

  it.each([
    '*',
    '',
    'null',
    'https://recepcao.example/caminho',
    'file:///teste',
    'https://recepcao.example,',
  ])('interrompe a configuração de origem inválida: %s', (origin) =>
    expect(() => corsOrigins(origin)).toThrow('CORS_ORIGINS'),
  );
});
