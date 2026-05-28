import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
    },
  },
  test: {
    projects: ['server/vitest.config.ts', 'client/vitest.config.ts'],
    testTimeout: 10_000,
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: [
        'server/src/**/*.js',
        'client/src/**/*.{ts,tsx}',
      ],
      exclude: [
        '**/*.test.{ts,tsx,js}',
        '**/*.spec.{ts,tsx,js}',
        '**/tests/helpers/**',
        '**/tests/fixtures/**',
        '**/node_modules/**',
        'client/src/main.tsx',        // Entry point only
        'client/src/App.tsx',         // Orchestrator - tested via components
      ],
      thresholds: {
        lines: 33,
        branches: 0,
        functions: 47,
        statements: 33,
      },
    },
  },
});