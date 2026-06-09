import { defineConfig } from 'vitest/config';
import path from 'path';

const frameworkRoot = __dirname;

export default defineConfig({
  root: frameworkRoot,
  esbuild: {
    // Required for TypeScript decorators used by EntityColumn and BaseEntity in plugin entity classes
    target: 'es2022',
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        useDefineForClassFields: false,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'packages/frontend'),
      '@/lib/admin-services': path.resolve(__dirname, 'packages/admin/lib/admin-services.ts'),
      '@fromcode119/core/client': path.resolve(__dirname, 'packages/core/src/client.ts'),
      '@fromcode119/react': path.resolve(__dirname, 'packages/react/src/index.ts'),
      '@fromcode119/sdk': path.resolve(__dirname, 'packages/sdk/src'),
      '@fromcode119/sdk/react': path.resolve(__dirname, 'packages/sdk/src/react/index.ts'),
      '@fromcode119/sdk/*': path.resolve(__dirname, 'packages/sdk/src/*'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: [
      path.resolve(frameworkRoot, 'packages/core/src/services/__tests__/**/*.test.ts').replace(/\\/g, '/'),
      path.resolve(frameworkRoot, 'packages/core/src/plugin/services/__tests__/**/*.test.ts').replace(/\\/g, '/'),
      path.resolve(frameworkRoot, 'packages/core/src/plugin/context/__tests__/**/*.test.ts').replace(/\\/g, '/'),
      path.resolve(frameworkRoot, 'packages/admin/lib/services/__tests__/**/*.test.ts').replace(/\\/g, '/'),
      path.resolve(frameworkRoot, 'packages/frontend/tests/**/*.test.ts').replace(/\\/g, '/'),
      // Plugin tests live in (and run from) each plugin's own repo — the framework never reaches
      // across sibling-checkout paths to run them (those resolve only on one combined layout).
    ],
  },
});
