import { defineConfig, devices } from '@playwright/test';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const vite = resolve(
  dirname(require.resolve('vite/package.json')),
  'bin/vite.js',
);
export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  outputDir: './test-results',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:5173',
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: `"${process.execPath}" "${vite}" --host 127.0.0.1 --port 5173 --strictPort`,
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `"${process.execPath}" e2e/api-fixture.mjs`,
      url: 'http://127.0.0.1:43117',
      reuseExistingServer: false,
      env: { NODE_ENV: 'test' },
    },
  ],
});
