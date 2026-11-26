import { config } from 'dotenv';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../dist/generated/prisma/client.js';
import { seedDemo } from '../dist/demo/seed.js';
config({ path: '.env', quiet: true });
const value = process.env.DATABASE_URL;
let valid = false;
try {
  const url = new URL(value);
  valid =
    url.protocol === 'mysql:' &&
    !url.search &&
    !url.hash &&
    /^\/[a-zA-Z0-9_]+$/.test(url.pathname);
} catch {
  /* Mensagem sem URL ou senha. */
}
if (!valid) {
  console.error('Configure uma DATABASE_URL MySQL válida antes do seed.');
  process.exit(1);
}
if (process.env.NODE_ENV === 'production') {
  console.error('O seed de demonstração não deve executar em produção.');
  process.exit(1);
}
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(value) });
try {
  const result = await seedDemo(prisma);
  console.log(
    'Demonstração preparada: ' +
      result.inserted +
      ' atendimentos inseridos, ' +
      result.reused +
      ' já existentes, ' +
      result.skipped +
      ' preservados sem inserir por alterações ou conflitos.',
  );
  for (const company of result.companies)
    console.log(company.id + ' — ' + company.nome);
} catch {
  console.error(
    'O seed não foi concluído. Confira a conexão, as migrações e possíveis colisões de IDs reservados (empresas 10001–10002; cadastros 10001–10104). Nenhum registro existente é atualizado ou apagado.',
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
