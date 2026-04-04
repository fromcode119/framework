import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname, '../..'),
  resolve: {
    alias: {
      '@fromcode119/sdk': path.resolve(__dirname, 'packages/sdk/src'),
      '@fromcode119/sdk/*': path.resolve(__dirname, 'packages/sdk/src/*'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: [
      'plugins/**/tests/**/*.test.ts',
      'plugins/**/tests/**/*.test.tsx',
      'packages/core/src/services/__tests__/**/*.test.ts',
      'packages/admin/lib/services/__tests__/**/*.test.ts',
    ],
  },
});
