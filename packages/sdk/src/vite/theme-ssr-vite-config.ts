import react from '@vitejs/plugin-react';
import path from 'node:path';
import type { UserConfig } from 'vite';
import { FromcodeThemeOverridesPlugin } from './fromcode-theme-overrides-plugin';
import { ThemeEntryGenerator } from './theme-entry-generator';

/**
 * Shared, framework-owned Vite config for building ANY theme's SERVER (SSR) bundle — the twin of
 * {@link ThemeViteConfig}, driven by the same env (THEME_DIR, THEME_SLUG) so a theme still ships NO build
 * config of its own.
 *
 * WHY: the storefront currently server-renders 25 characters — just the `<title>`. Every pixel, including
 * the LCP image, is painted after hydration, which pins LCP at ~11 s and caps Lighthouse at ~66 (see
 * `STOREFRONT-PERF-BASELINE.md`). Rendering the theme on the server is the only way past that; this
 * config produces the artifact the server needs.
 *
 * Differences from the client config, each load-bearing:
 *  - `ssr: true` + `target: node20` — output runs in Node, not a browser.
 *  - Externals stay BARE specifiers, but ONLY for the packages whose IDENTITY must be shared with the
 *    host process: React (one dispatcher) and `@fromcode119/*` (one `Enum`, one context registry). The
 *    client bundle rewrites those to the `window` runtime registry (`rollup-plugin-external-globals`)
 *    because it loads with no import map; on the server there IS no registry and Node resolves them
 *    normally — react/react-dom through the resolve hook in `ThemeSsrRuntime`.
 *    Every other dependency the theme uses — its UI-component library, its styling engine, its animation
 *    library, whatever it happens to be — is BUNDLED, exactly as the client bundle already bundles it
 *    (the framework names none of them). Left external, those resolve only through the THEME's own
 *    `node_modules`, which exists
 *    in a dev checkout but NOT in an installed theme (the package ships no `node_modules`) — so on a
 *    real deployment the server bundle failed to import, `ThemeServerRenderer` fell back to null, and
 *    every page served an empty body. A server bundle must be self-contained.
 *  - No `publicDir` — assets are already emitted by the client build; copying them twice would clobber.
 *  - No minify — server code is never shipped over the wire, and readable frames make SSR errors legible.
 *
 * Vite requires the config module to DEFAULT-export its object. That single required export is generated
 * as build glue (nextor's `ViteConfigEntryGenerator`) so the authored source stays a plain class.
 */
export class ThemeSsrViteConfig {
  /**
   * Left for Node to resolve at runtime rather than bundled — ONLY packages whose singleton identity
   * matters (see the class comment). Regexes (not exact strings) so deep imports are external too: a
   * deep `react-dom/server` that slipped through would bundle a second React.
   *
   * Nothing may be added here that an INSTALLED theme cannot resolve. An installed theme has no
   * `node_modules`, so an external that is not provided by the frontend itself makes the whole server
   * bundle unimportable — silently, because every SSR failure path returns null.
   */
  private static readonly EXTERNAL = [
    /^react($|\/)/,
    /^react-dom($|\/)/,
    /^@fromcode119\//,
  ];

  static create(): UserConfig {
    const themeDir = process.env.THEME_DIR as string;
    const themeSlug = process.env.THEME_SLUG || 'theme';

    return {
      plugins: [
        react({ jsxRuntime: 'automatic' }),
        FromcodeThemeOverridesPlugin.create({ themeSlug, priority: 11 }),
      ],
      define: { 'process.env.NODE_ENV': JSON.stringify('production') },
      // Vite's DEFAULT would copy the theme's public/ (favicons, fonts — and the site's user uploads)
      // into ui-ssr/ on every build. The server bundle dir must hold only modules; assets are already
      // emitted by the client build. Leaving this unset once shipped user-uploaded PDFs inside the
      // packed theme tarball.
      publicDir: false,
      // A theme addresses its own source as `@theme/*`; without this the SSR build dies on the first
      // such import ("Rollup failed to resolve a @theme/<dir>/constants import"). Same mapping the
      // client config declares — it is the theme's own alias, not a framework path.
      resolve: { alias: { '@theme': path.join(themeDir, 'src') } },
      // Same legacy-decorator settings as the client build: Vite compiles theme sources with esbuild and
      // does NOT read the theme's tsconfig, so without this a `@prop` in a theme component is a parse
      // error and the whole build dies. `useDefineForClassFields: false` because a defined field would
      // shadow the accessor the decorator installs.
      esbuild: {
        tsconfigRaw: {
          compilerOptions: { experimentalDecorators: true, useDefineForClassFields: false },
        },
      },
      build: {
        ssr: true,
        outDir: path.join(themeDir, 'ui-ssr'),
        emptyOutDir: true,
        target: 'node20',
        minify: false,
        commonjsOptions: { include: [/node_modules/], transformMixedEsModules: true },
        lib: {
          // GENERATED by ThemeEntryGenerator (framework theme policy) — themes ship no entry file.
          entry: ThemeEntryGenerator.resolveEntry(themeDir),
          fileName: () => 'entry.mjs',
          formats: ['es'],
        },
        // `lib.fileName` is IGNORED under `ssr: true` (the entry would land as `index.mjs`, named after
        // `src/theme-entry.generated.jsx`), so the entry name is pinned here instead. Consumers resolve exactly
        // `ui-ssr/entry.mjs`; leaving it to the entry's basename would make the contract depend on what
        // a theme happens to call its source file.
        rollupOptions: {
          external: ThemeSsrViteConfig.EXTERNAL,
          output: { entryFileNames: 'entry.mjs', chunkFileNames: '[name]-[hash].mjs' },
        },
      },
    };
  }
}
