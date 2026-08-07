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
  // Same reason as `@fromcode119/auth` below: without these, every api/admin/frontend suite imported
  // `@fromcode119/core` through the workspace symlink, i.e. `packages/core/dist/index.js`. On
  // 2026-08-06 an api source change began calling `SystemSettingsExposureUtils` — present in core's
  // src, absent from the built dist — and two green tests went red with
  // `Cannot read properties of undefined (reading 'toExposableSettingsMap')` until core was rebuilt.
  // Tests must exercise SOURCE; asserting against a stale dist is a lie about what the code does.
  //
  // ORDER IS LOAD-BEARING (see the `@fromcode119/react` note below): a Vite string alias replaces by
  // PREFIX, so the bare entry — which points at a FILE — would turn `@fromcode119/core/utils` into
  // `…/core/src/index.tsutils`. EVERY core subpath now mirrors the src layout, so the single
  // trailing-slash entry covers `/client`, `/utils` (→ src/utils/index.ts), `/shared`, and the deep
  // `/constants/*.constants` imports the admin and the service worker use. Do not reintroduce a
  // FLATTENED export (a specifier that does not mirror the file path): it needs a special-case entry
  // here, ahead of the prefix entry that would otherwise swallow it, and it is a second name for a
  // file that already has a canonical one.
  '@fromcode119/core/client': path.resolve(frameworkRoot, 'packages/core/src/client.ts'),
  '@fromcode119/core/': `${path.resolve(frameworkRoot, 'packages/core/src')}/`,
  '@fromcode119/core': path.resolve(frameworkRoot, 'packages/core/src/index.ts'),
  '@fromcode119/typor/build': path.resolve(frameworkRoot, 'packages/typor/src/index.ts'),
  // Subpath BEFORE the bare specifier: a Vite string alias replaces by PREFIX, so the bare entry —
  // which points at a FILE — turned `@fromcode119/react/x` into `…/react/src/index.tsx`. That is why
  // `content-rendering-utils.test.ts` could not even be collected. The apps already alias
  // `@fromcode119/react/*` → `../react/src/*` (frontend `next.config.js`); this matches them.
  '@fromcode119/react/': `${path.resolve(frameworkRoot, 'packages/react/src')}/`,
  '@fromcode119/react': path.resolve(frameworkRoot, 'packages/react/src/index.ts'),
  // Without this the api suites imported `@fromcode119/auth` through node_modules, i.e. the package's
  // BUILT dist — so they asserted against a five-day-old build and a source fix could not move them.
  // Tests must exercise source; a stale dist passing is the same class of lie as a dark test file.
  '@fromcode119/auth': path.resolve(frameworkRoot, 'packages/auth/src/index.ts'),
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
        resolve: { alias: { ...sharedAlias } },
        test: {
          // The api package's 21 test files matched NO project's include glob, so every one of them was
          // dark — collected by nothing, reported by nothing, and green by default. The auth-middleware
          // suite in particular guards which session cookie each surface may authenticate from, which is
          // exactly the boundary a cross-surface logout bug crosses.
          name: 'api',
          root: frameworkRoot,
          environment: 'node',
          globals: true,
          include: [glob('packages/api/tests/**/*.test.ts')],
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
          // Was two narrow globs that collected 3 of the admin's 27 test files — the other 24 (appearance
          // registries, collection utils, timezone, field helpers) were dark, so "admin: green" meant
          // almost nothing. `.tsx` suites are deliberately still excluded: they render components and
          // need a jsdom environment this node project does not provide.
          include: [glob('packages/admin/**/*.test.ts')],
          exclude: ['**/node_modules/**', '**/dist/**'],
        },
      },
      {
        esbuild,
        plugins: [typorPlugin],
        resolve: { alias: { ...sharedAlias, '@/': `${path.resolve(frameworkRoot, 'packages/admin')}/` } },
        test: {
          // The admin's `.tsx` suites render components, so they need a DOM. There was no jsdom project,
          // so every one of them was uncollected — component rendering was verified by nothing.
          name: 'admin-dom',
          root: frameworkRoot,
          environment: 'jsdom',
          globals: true,
          setupFiles: [glob('vitest.setup.dom.ts')],
          include: [glob('packages/admin/**/*.test.tsx')],
          exclude: ['**/node_modules/**', '**/dist/**'],
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
