import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'server',
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts', 'tests/**/*.test.js'],
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    testTimeout: 10_000,
    deps: {
      interopDefault: true,
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'tests/**', 'src/**/*.d.ts'],
      thresholds: {
        global: {
          lines: 70,
          branches: 65,
          functions: 70,
        }
      }
    }
  },
  resolve: {
    alias: {
      '~': '/home/rauty/Nymphs-Brain/WORBI/server/src',
    },
  },
});