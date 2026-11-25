import { defineConfig } from 'vitest/config';
import base from './vitest.config.js';

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ['test/**/*.integration-spec.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    hookTimeout: 30000,
    testTimeout: 15000,
    setupFiles: ['./test/setup-integration.ts'],
  },
});
