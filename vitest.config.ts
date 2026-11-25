import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true,
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    exclude: ['src/generated/**', 'node_modules/**'],
    setupFiles: ['./test/setup.ts'],
    clearMocks: true,
    restoreMocks: true,
  },
});
