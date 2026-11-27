import { testDatabaseUrl } from '../scripts/test-database.mjs';

describe('Proteção do banco de integração', () => {
  it('aceita uma URL exclusiva de testes', () => {
    const value = 'mysql://teste:senha@localhost:3306/barbearia_test';
    expect(testDatabaseUrl({ DATABASE_TEST_URL: value })).toBe(value);
  });

  it('não usa a URL normal como alternativa', () => {
    expect(() =>
      testDatabaseUrl({
        DATABASE_URL: 'mysql://teste:senha@localhost:3306/barbearia',
      }),
    ).toThrow('DATABASE_TEST_URL');
  });

  it.each([
    'mysql://teste:senha@localhost/barbearia',
    'mysql://teste:senha@localhost/mysql',
    'postgresql://teste:senha@localhost/barbearia_test',
    'mysql://teste:senha@localhost/barbearia_test?database=outra',
    'mysql://teste:senha@localhost/barbearia_test#outra',
    'mysql://teste:senha@localhost/barbearia%5Ftest',
    'URL_INVALIDA_COM_SEGREDO',
  ])('recusa destino inadequado sem incluir a URL no erro', (value) => {
    expect(() => testDatabaseUrl({ DATABASE_TEST_URL: value })).toThrow();
    try {
      testDatabaseUrl({ DATABASE_TEST_URL: value });
    } catch (error) {
      expect((error as Error).message).not.toContain(value);
    }
  });

  it('rejeita o mesmo banco mesmo com credenciais e porta escrita diferentes', () => {
    expect(() =>
      testDatabaseUrl({
        DATABASE_URL: 'mysql://usuario1:senha@localhost/barbearia_test',
        DATABASE_TEST_URL:
          'mysql://usuario2:outra@localhost:3306/barbearia_test',
      }),
    ).toThrow('diferente');
  });
});
