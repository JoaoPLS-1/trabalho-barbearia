import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { testDatabaseUrl } from './test-database.mjs';

config({ path: '.env', quiet: true });
config({ path: '.env.test.local', quiet: true });
let databaseUrl;
try {
  databaseUrl = testDatabaseUrl();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const env = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_TEST_URL: databaseUrl,
};

for (const [relativePath, args] of [
  [
    '../node_modules/prisma/build/index.js',
    ['migrate', 'deploy', '--config', 'prisma7.config.ts'],
  ],
  [
    '../node_modules/vitest/vitest.mjs',
    ['run', '--config', 'vitest.config.integration.ts'],
  ],
]) {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL(relativePath, import.meta.url)), ...args],
    {
      env: relativePath.includes('prisma')
        ? { ...env, DATABASE_URL: databaseUrl }
        : env,
      stdio: 'inherit',
      shell: false,
    },
  );
  if (result.error) {
    console.error(
      'Não foi possível iniciar a verificação. Confirme a instalação das dependências.',
    );
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}
