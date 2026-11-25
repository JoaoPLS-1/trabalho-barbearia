import 'reflect-metadata';
import { config } from 'dotenv';
import { testDatabaseUrl } from '../scripts/test-database.mjs';

config({ path: '.env', quiet: true });
config({ path: '.env.test.local', quiet: true });
// A execução direta do Vitest recebe as mesmas proteções do runner npm.
process.env.DATABASE_URL = testDatabaseUrl();
process.env.NODE_ENV = 'test';
