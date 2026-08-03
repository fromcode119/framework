import react from '@vitejs/plugin-react';
import path from 'node:path';
import type { UserConfig } from 'vite';
import { PluginUiCssAsTextPlugin } from './plugin-ui-css-as-text-plugin';

/**
 * Shared, framework-owned Vite config for building a plugin's STOREFRONT UI as a SERVER (SSR) bundle —
 * the plugin twin of {@link ThemeSsrViteConfig}, driven by the same `PLUGIN_UI_DIR` / `PLUGIN_SLUG` /
 * `PLUGIN_NAMESPACE` env the client build uses, so a plugin still ships no build config of its own.
 *
 * WHY: server-rendering the THEME got the storefront its chrome, but the page BODY is a block flow owned
 * by the cms plugin's browser bundle — so the LCP element (the first block's image) still does not exist
 * until hydration, and LCP still scores 0. Giving a plugin's storefront UI a Node-importable bundle is
 * what lets the server render that flow. See `STOREFRONT-PERF-BASELINE.md`.
 *
 * Differences from the client config, each load-bearing:
 *  - `ssr: true` + `target: node20` — output runs in Node, not a browser.
 *  - Externals stay BARE specifiers so Node resolves ONE `react` / `@fromcode119/*` instance. Bundling
 *    copies would give the server a second React (dead hooks) and a second SDK (broken `Enum` identity).
 *  - No minify — server code is never shipped over the wire, and readable frames make SSR errors legible.
 *  - The SAME `?raw` CSS convention as the client build. A plugin imports its stylesheet as a STRING and
 *    injects it itself, so the server bundle must transform it identically — otherwise every plugin that
 *    styles a storefront surface (ecommerce checkout, forms, …) simply has no server bundle.
 *
 * Vite requires the config module to DEFAULT-export its object. That single required export is generated
 * as build glue (nextor's `ViteConfigEntryGenerator`) so the authored source stays a plain class.
 */
export class PluginUiSsrViteConfig {
  /**
   * Left for Node to resolve at runtime rather than bundled. Regexes (not exact strings) so deep imports
   * are external too — a deep import that slipped through would bundle a duplicate of a package whose
   * singleton identity matters.
   */
  private static readonly EXTERNAL = [
    /^react($|\/)/,
    /^react-dom($|\/)/,
    /^@fromcode119\//,
    // The icon set the client config externalizes too. Bundling it would pull ~1000 icon components into
    // a server bundle that renders a handful of them.
    /^lucide-react($|\/)/,
  ];

  static create(): UserConfig {
    const uiDir = process.env.PLUGIN_UI_DIR as string;
    const outDir = process.env.PLUGIN_SSR_OUT_DIR as string;

    return {
      cacheDir: `/tmp/vite-plugin-${process.env.PLUGIN_SLUG || 'x'}-ssr`,
      plugins: [PluginUiCssAsTextPlugin.create(), react({ jsxRuntime: 'automatic' })],
      define: {
        // ONE injected object behind a dotted key, so the entry reads it through a class getter
        // instead of three bare `__plugin*` identifiers that would need an ambient declaration.
        'globalThis.__fromcodePluginUi': JSON.stringify({
          namespace: process.env.PLUGIN_NAMESPACE || '',
          slug: process.env.PLUGIN_SLUG || '',
          uiBundle: 'frontend',
        }),
        'process.env.NODE_ENV': JSON.stringify('production'),
      },
      // Same legacy-decorator settings as every other bundle: plugins carry no tsconfig, so without this
      // esbuild compiles TC39 STANDARD decorators and every `@prop` throws the moment the module loads.
      esbuild: {
        tsconfigRaw: {
          compilerOptions: { experimentalDecorators: true, useDefineForClassFields: false },
        },
      },
      publicDir: false,
      build: {
        ssr: true,
        outDir,
        emptyOutDir: true,
        target: 'node20',
        minify: false,
        commonjsOptions: { include: [/node_modules/], transformMixedEsModules: true },
        lib: {
          entry: path.join(uiDir, '.plugin-entry.tsx'),
          fileName: () => 'entry.mjs',
          formats: ['es'],
        },
        // `lib.fileName` is IGNORED under `ssr: true` — the entry would land named after the source file
        // (`.plugin-entry.mjs`). Pinned here so consumers resolve exactly `ui-ssr/entry.mjs`, the same
        // contract themes use.
        rollupOptions: {
          external: PluginUiSsrViteConfig.EXTERNAL,
          output: { entryFileNames: 'entry.mjs', chunkFileNames: '[name]-[hash].mjs' },
        },
      },
    };
  }
}
