import react from '@vitejs/plugin-react';
import path from 'node:path';
import type { Alias, UserConfig } from 'vite';
import { NextConfigEnv } from '../../../config/next-config-env';
// Relative on purpose, like the line above: Vite loads this config with its own bundler, before any
// alias applies, and the constants file carries no imports of its own.
// `@fromcode119/core/constants/*` — core's own narrow public export, NOT its private `@core/*` alias
// and NOT the `/client` barrel. This file is loaded by plain Node
// (vite reads the config through a CJS require), which has no TypeScript path mapping — the private
// alias resolves locally and then fails inside the Docker build with
// `Cannot find module '@core/constants/runtime-asset.constants'`. The `/client` barrel is the wrong fix
// too: it drags reactor's decorators into a tsx-run CLI and throws on an undefined descriptor. This
// path reaches ONE import-free file, which is what the constants module was written to be.
import { RuntimeAssetConstants } from '@fromcode119/core/constants/runtime-asset.constants';

/**
 * Vite config for the storefront RUNTIME bundle: one classic (IIFE) script holding React 19 +
 * `react-dom/client` + the provider stack, bridge, import-map installer, plugin loader and shells —
 * the same code that is `StorefrontRuntimeTree` under Next today — built OUTSIDE Next so an islands
 * document can load it with no `_next/static` chunk and no flight payload.
 *
 * Resolution is the whole risk (STOREFRONT-PERF-BASELINE.md, "islands step 2 — backed out": a second
 * hand-copied alias/stub list drifted and the bundle pulled server code). So this config owns NO list:
 * every alias, server-only stub and Node built-in fallback is read from `config/next-config-env.js`,
 * the same module `next.config.js` reads, and only ADAPTED to Vite's option shape here.
 *
 * The framework names no UI library: theme and plugin bundles remain separate artifacts loaded at
 * runtime through the registry / import map, exactly as today.
 *
 * Vite requires the config module to DEFAULT-export its object. That single required export is
 * generated as build glue (next-build-codegen's `ViteConfigEntryGenerator`, see `build:frontend-runtime` in the
 * root package.json) so this authored source stays a plain class.
 */
export class FrontendRuntimeViteConfig {
  /** Public URL segment the bundle is served from — the framework constant `RouteSegmentUtils` reserves. */
  static readonly PUBLIC_SEGMENT = RuntimeAssetConstants.SEGMENT;

  /** Global the IIFE assigns its (unused) export to; Vite demands a name for the iife format. */
  private static readonly GLOBAL_NAME = '__fromcodeStorefrontRuntime';

  /** `packages/frontend` — this file lives in `packages/frontend/build`. */
  private static get frontendDir(): string {
    return path.resolve(__dirname, '..');
  }

  private static get entryFile(): string {
    return path.join(FrontendRuntimeViteConfig.frontendDir, 'runtime', 'frontend-runtime-entry.tsx');
  }

  static get outDir(): string {
    return path.join(FrontendRuntimeViteConfig.frontendDir, 'public', FrontendRuntimeViteConfig.PUBLIC_SEGMENT);
  }

  /** Escape a specifier for use inside an anchored RegExp. */
  private static escape(specifier: string): string {
    return specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * The shared source aliases in Vite shape. Exact single-file entries come FIRST as anchored regexes;
   * directory entries use Vite's string form, which matches the bare specifier and any `/<subpath>`,
   * so `@fromcode119/core` -> `core/src` (index resolved by Vite) and `@fromcode119/core/utils` ->
   * `core/src/utils`. A directory entry must never point at a FILE: a string alias replaces by prefix
   * and would turn `@fromcode119/react/x` into `…/index.tsx` (the bug vitest.plugins.config.ts records).
   */
  private static get sourceAliases(): Alias[] {
    const entries = NextConfigEnv.getSourceAliases(FrontendRuntimeViteConfig.frontendDir);
    const files: Alias[] = [];
    const dirs: Alias[] = [];
    for (const entry of entries) {
      if (entry.file) {
        files.push({ find: new RegExp(`^${FrontendRuntimeViteConfig.escape(entry.specifier)}$`), replacement: entry.file });
      } else {
        dirs.push({ find: entry.specifier, replacement: entry.dir });
      }
    }
    return [...files, ...dirs];
  }

  /** Server-only packages -> the shared no-op stub (bare specifier only, like webpack's `$`). */
  private static get serverOnlyStubAliases(): Alias[] {
    const dir = FrontendRuntimeViteConfig.frontendDir;
    return Object.entries(NextConfigEnv.getServerOnlyStubFiles() as Record<string, string>).map(([specifier, stub]) => ({
      find: new RegExp(`^${FrontendRuntimeViteConfig.escape(specifier)}$`),
      replacement: stub,
    }));
  }

  /**
   * Node built-ins -> empty module (`false` in the shared list) or the named replacement. Both the
   * bare (`fs`) and `node:`-prefixed (`node:fs`) spellings are covered — the backed-out attempt hit
   * `node:crypto` through exactly this graph.
   */
  private static get nodeBuiltinAliases(): Alias[] {
    const dir = FrontendRuntimeViteConfig.frontendDir;
    const empty = NextConfigEnv.getEmptyModuleFile();
    return Object.entries(NextConfigEnv.getNodeBuiltinFallbacks()).map(([name, fallback]) => ({
      find: new RegExp(`^(node:)?${FrontendRuntimeViteConfig.escape(name)}$`),
      replacement: fallback === false ? empty : String(fallback),
    }));
  }

  static create(): UserConfig {
    // The SAME environment `next.config.js` builds under: the framework's root `.env` / `.env.local`
    // (loaded by `NextConfigEnv`, explicit shell variables win). Without this a standalone
    // `npm run build:frontend-runtime` baked an EMPTY public API URL where `next build` baked the
    // configured one — two bundles of the same graph disagreeing about where the API lives.
    NextConfigEnv.initializeEnvironment();
    const frontendDir = FrontendRuntimeViteConfig.frontendDir;
    return {
      root: frontendDir,
      // A pure script bundle: nothing from `public/` is an input, and copying it would recurse into
      // the very directory this build writes.
      publicDir: false,
      plugins: [react({ jsxRuntime: 'automatic' })],
      define: {
        // Next inlines these at build; the IIFE has no `process` until GlobalInitializer installs the
        // browser shim, so every build-time env read in the graph must be resolved statically.
        'process.env.NODE_ENV': JSON.stringify('production'),
        'process.env.NEXT_PUBLIC_API_URL': JSON.stringify(process.env.NEXT_PUBLIC_API_URL || ''),
        'process.env.NEXT_PUBLIC_API_ORIGIN_MAP': JSON.stringify(process.env.NEXT_PUBLIC_API_ORIGIN_MAP || ''),
        'process.env': '{}',
      },
      // Legacy decorators (`@prop`, `@state`, `@bound`) — reactor's signatures — with
      // `useDefineForClassFields: false` so a defined field never shadows the accessor the decorator
      // installs. Same setting as the theme and plugin-UI configs (theme-vite-config.ts).
      esbuild: {
        tsconfigRaw: {
          compilerOptions: { experimentalDecorators: true, useDefineForClassFields: false },
        },
      },
      resolve: {
        alias: [
          ...FrontendRuntimeViteConfig.sourceAliases,
          ...FrontendRuntimeViteConfig.serverOnlyStubAliases,
          ...FrontendRuntimeViteConfig.nodeBuiltinAliases,
        ],
        // ONE React: every aliased source tree resolves react/react-dom from the workspace root.
        dedupe: ['react', 'react-dom'],
      },
      build: {
        outDir: FrontendRuntimeViteConfig.outDir,
        emptyOutDir: true,
        target: 'es2022',
        minify: 'esbuild',
        sourcemap: false,
        // `manifest.json` beside the bundle maps the entry to its hashed filename — what a document
        // renderer reads to emit the `<script src>`.
        manifest: 'manifest.json',
        // The stub modules live OUTSIDE node_modules and are CommonJS.
        commonjsOptions: { include: [/node_modules/, /[\\/]packages[\\/]frontend[\\/]webpack[\\/]/], transformMixedEsModules: true },
        lib: {
          entry: FrontendRuntimeViteConfig.entryFile,
          name: FrontendRuntimeViteConfig.GLOBAL_NAME,
          // Classic script, not `type="module"`: the import map is written dynamically by
          // ImportMapInstaller and must precede the first module resolution (plan §3.1). Rollup inlines
          // every dynamic import for this format.
          formats: ['iife'],
        },
        rollupOptions: {
          // The database stand-in exports only a default proxy; the named imports server-only modules write
          // against it become `undefined` instead of a build error — nothing in the browser calls them.
          shimMissingExports: true,
          output: {
            entryFileNames: 'runtime-[hash].js',
            compact: true,
          },
        },
      },
    };
  }
}
