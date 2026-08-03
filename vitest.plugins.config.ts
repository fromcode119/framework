import { defineConfig } from 'vitest/config';
import path from 'path';
import { TyporSyntaxPlugin } from './packages/typor/src/typor-syntax-plugin';

/**
 * vitest is its own compiler path: it transpiles source with esbuild and never sees the Next loader or the
 * esbuild plugin, so `class X extends A, B` would be a parse error here. Apply typor's rewrite in a Vite
 * transform so tests compile the same source everything else does.
 */
const typorPlugin = {
  name: 'typor-multiple-inheritance',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    if (!/\.(t|j)sx?$/.test(id) || id.includes('node_modules')) return null;
    if (!TyporSyntaxPlugin.handles(code)) return null;
    return { code: TyporSyntaxPlugin.transform(code), map: null };
  },
};

const frameworkRoot = __dirname;

/** Decorator support required by EntityColumn / BaseEntity in plugin entity classes. */
const esbuild = {
  target: 'es2022',
  tsconfigRaw: {
    compilerOptions: {
      experimentalDecorators: true,
      useDefineForClassFields: false,
    },
  },
} as const;

/**
 * Each typor-built package's PRIVATE alias for its own `src` (`@core/…`, `@react/…`, …).
 *
 * vitest resolves through Vite, which does NOT read tsconfig `paths`, so the same map the compiler gets
 * from tsconfig has to be repeated here or every aliased import fails to resolve at test time.
 * `next` is `@nextjs/` because `@next` is a real npm scope in node_modules.
 */
const packageAlias = Object.fromEntries(
  ([
    ['ai', '@ai'], ['core', '@core'], ['database', '@database'], ['react', '@react'],
    ['api', '@api'], ['auth', '@auth'], ['cache', '@cache'], ['marketplace-client', '@marketplace-client'],
    ['media', '@media'], ['email', '@email'], ['scheduler', '@scheduler'], ['plugins', '@plugins'],
    ['mcp', '@mcp'], ['sdk', '@sdk'], ['next', '@nextjs'], ['cli', '@cli'],
  ] as ReadonlyArray<readonly [string, string]>)
    .map(([pkg, prefix]) => [`${prefix}/`, `${path.resolve(frameworkRoot, `packages/${pkg}/src`)}/`]),
);

/** Package aliases that mean the same thing everywhere. */
const sharedAlias = {
  // The package aliases must come FIRST: a Vite string alias matches by PREFIX, so the app-level `@/`
  // entry below would otherwise swallow `@core/...` — the same prefix-shadowing bug that once routed
  // admin imports into the frontend.
  ...packageAlias,
  '@fromcode119/core/client': path.resolve(frameworkRoot, 'packages/core/src/client.ts'),
  '@fromcode119/typor/build': path.resolve(frameworkRoot, 'packages/typor/src/index.ts'),
  '@fromcode119/react': path.resolve(frameworkRoot, 'packages/react/src/index.ts'),
  '@fromcode119/sdk': path.resolve(frameworkRoot, 'packages/sdk/src'),
  '@fromcode119/sdk/react': path.resolve(frameworkRoot, 'packages/sdk/src/react/index.ts'),
  '@fromcode119/sdk/*': path.resolve(frameworkRoot, 'packages/sdk/src/*'),
};

const glob = (pattern: string): string => path.resolve(frameworkRoot, pattern).replace(/\\/g, '/');

/**
 * ONE PROJECT PER APP, because `@` is app-relative: it means `packages/admin` inside the admin and
 * `packages/frontend` inside the storefront. A single flat alias map cannot express that — the bare
 * `@` entry swallowed every `@/...` id by prefix and routed ADMIN imports into the frontend, so those
 * suites failed to resolve and never ran. Projects give each app its own `@`, so no per-file aliases.
 *
 * Plugin tests live in (and run from) each plugin's own repo — the framework never reaches across
 * sibling-checkout paths to run them (those resolve only on one combined layout).
 */
export default defineConfig({
  test: {
    projects: [
      {
        esbuild,
        plugins: [typorPlugin],
        resolve: { alias: { ...sharedAlias } },
        test: {
          name: 'core',
          root: frameworkRoot,
          environment: 'node',
          globals: true,
          // Collect EVERY core/database test, colocated or under __tests__. Narrow globs previously
          // left ~100 framework test files uncollected — dark, not passing.
          include: [
            glob('packages/core/**/*.test.ts'),
            glob('packages/database/**/*.test.ts'),
          ],
          exclude: ['**/node_modules/**', '**/dist/**'],
        },
      },
      {
        esbuild,
        plugins: [typorPlugin],
        // reactor is standalone — no framework aliases, and its own sources import each other relatively.
        test: {
          name: 'reactor',
          root: frameworkRoot,
          environment: 'node',
          globals: true,
          include: [glob('packages/reactor/tests/**/*.test.ts')],
        },
      },
      {
        esbuild,
        plugins: [typorPlugin],
        resolve: { alias: { ...sharedAlias, '@/': `${path.resolve(frameworkRoot, 'packages/admin')}/` } },
        test: {
          name: 'admin',
          root: frameworkRoot,
          environment: 'node',
          globals: true,
          include: [
            glob('packages/admin/lib/services/tests/**/*.test.ts'),
            glob('packages/admin/app/services/**/*.test.ts'),
          ],
        },
      },
      {
        esbuild,
        plugins: [typorPlugin],
        resolve: { alias: { ...sharedAlias, '@/': `${path.resolve(frameworkRoot, 'packages/frontend')}/` } },
        test: {
          name: 'frontend',
          root: frameworkRoot,
          environment: 'node',
          globals: true,
          include: [glob('packages/frontend/tests/**/*.test.ts')],
        },
      },
    ],
  },
});
