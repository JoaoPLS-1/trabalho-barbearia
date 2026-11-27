export function testDatabaseUrl(env = process.env) {
  // Nunca usar DATABASE_URL como fallback.
  const value = env.DATABASE_TEST_URL;
  if (!value) {
    throw new Error(
      'Configure DATABASE_TEST_URL em .env.test.local; use um banco exclusivo terminado em _test.',
    );
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('DATABASE_TEST_URL não é uma URL MySQL válida.');
  }
  const database = url.pathname.slice(1);
  if (url.protocol !== 'mysql:' || !/^[a-zA-Z0-9_]+_test$/.test(database)) {
    throw new Error(
      'Os testes exigem MySQL com nome de banco terminado em _test.',
    );
  }
  if (url.search || url.hash) {
    throw new Error(
      'DATABASE_TEST_URL não deve conter parâmetros ou fragmentos.',
    );
  }
  if (env.DATABASE_URL) {
    let development;
    try {
      development = new URL(env.DATABASE_URL);
    } catch {
      throw new Error(
        'DATABASE_URL inválida; não foi possível verificar o isolamento.',
      );
    }
    if (
      development.hostname.toLowerCase() === url.hostname.toLowerCase() &&
      (development.port || '3306') === (url.port || '3306') &&
      development.pathname.toLowerCase() === url.pathname.toLowerCase()
    ) {
      throw new Error(
        'O banco de testes precisa ser diferente de DATABASE_URL.',
      );
    }
  }
  return value;
}
