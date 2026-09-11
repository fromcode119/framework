import path from 'path';

/**
 * Standalone config — each plugin is its own repo and runs its own suite; the framework's
 * `vitest.plugins.config.ts` deliberately does not reach across sibling checkouts.
 *
 * Exported as a PLAIN OBJECT, not through `defineConfig`: vitest is installed in the framework
 * workspace, so a `from 'vitest/config'` import cannot resolve when vite loads this file from the
 * plugin directory (MODULE_NOT_FOUND). `defineConfig` is only a typing helper, so nothing is lost.
 *
 * NO alias: never reference the framework's on-disk location (`../../framework/...`), which only
 * resolves in a combined local checkout. `@fromcode119/sdk` is declared in this plugin's
 * package.json (peerDependency + devDependency) and resolved from node_modules, exactly as a
 * standalone plugin repo would. For local dev against the unpublished SDK, `npm link
 * @fromcode119/sdk` to the framework checkout — that does not touch this file.
 *
 * The include is a GLOB, never a hand-listed set of files: an enumerated list silently stops
 * collecting every test added after it was written, which is how 15 of ecommerce's 19 suites and
 * 5 of forms' 8 came to be dark.
 */
export default {
  // `@plugin/` is this plugin's alias for its OWN src — self-contained, so it honours the rule above
  // (it names no framework path). Without it every aliased import fails to resolve under vitest, which
  // resolves through vite and does not read tsconfig `paths`.
  resolve: {
    alias: { '@plugin/': path.resolve(__dirname).replace(/\\/g, '/') + '/' },
  },
  esbuild: {
    // Required for the TypeScript decorators used by BaseEntity / EntityColumn in entity classes.
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        useDefineForClassFields: false,
      },
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: [path.resolve(__dirname, 'tests/**/*.test.{ts,tsx}').replace(/\\/g, '/')],
  },
};
