import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname, '../..'),
  test: {
    environment: 'node',
    globals: true,
    include: [
      'plugins/**/tests/**/*.test.ts',
      'plugins/**/tests/**/*.test.tsx',
    ],
  },
});
