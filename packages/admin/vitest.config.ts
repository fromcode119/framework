import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@fromcode119/react': path.resolve(__dirname, '../react/src'),
      '@fromcode119/sdk': path.resolve(__dirname, '../sdk/src'),
    },
  },
});
