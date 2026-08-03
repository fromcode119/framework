import react from '@vitejs/plugin-react';
import path from 'node:path';
import type { UserConfig } from 'vite';
import { PluginUiCssAsTextPlugin } from './plugin-ui-css-as-text-plugin';

/**
 * Shared, framework-owned Vite config for building a plugin's UI bundle from the static glob entry
 * (`plugin-ui-entry.tsx`). One config for every plugin — driven by env vars, no per-plugin config file.
 * react / @fromcode119/sdk are external (the browser import map resolves them to the single runtime
 * registry at runtime, same as the old esbuild `--external`); a plugin's own runtime deps (chart.js,
 * @tremor) bundle.
 *
 * Vite requires the config module to DEFAULT-export its object. That single required export is generated
 * as build glue (see nextor's `ViteConfigEntryGenerator`) so the authored source stays a plain class.
 */
export class PluginUiViteConfig {
  static create(): UserConfig {
    const uiDir = process.env.PLUGIN_UI_DIR as string;

    return {
      // Per-plugin+bundle cache dir so concurrent plugin builds (the full build runs them in parallel)
      // never collide on a shared Vite cache.
      cacheDir: `/tmp/vite-plugin-${process.env.PLUGIN_SLUG || 'x'}-${process.env.UI_BUNDLE || 'admin'}`,
      plugins: [PluginUiCssAsTextPlugin.create(), react({ jsxRuntime: 'automatic' })],
      define: {
        __pluginNamespace: JSON.stringify(process.env.PLUGIN_NAMESPACE || ''),
        __pluginSlug: JSON.stringify(process.env.PLUGIN_SLUG || ''),
        __uiBundle: JSON.stringify(process.env.UI_BUNDLE || 'admin'),
        'process.env.NODE_ENV': JSON.stringify('production'),
      },
      // Decorators are LEGACY (`experimentalDecorators`), matching reactor's `@prop(target, key)` /
      // `@state` signatures. Plugins carry no tsconfig, so without this esbuild compiles TC39 STANDARD
      // decorators and calls them as `(value, context)` — every bundle then throws
      // "@prop can only decorate string-named fields" the moment it loads, taking the plugin's whole
      // admin UI with it. `useDefineForClassFields: false` for the same reason as everywhere else: a
      // defined field would shadow the accessor the decorator installs.
      esbuild: {
        tsconfigRaw: {
          compilerOptions: { experimentalDecorators: true, useDefineForClassFields: false },
        },
      },
      // Do NOT copy Vite's default publicDir (the dev site's media) into the plugin's output. Without this,
      // every plugin build dumps hundreds of site images into src/ui.
      publicDir: false,
      build: {
        outDir: uiDir,
        emptyOutDir: false,
        target: 'es2022',
        minify: 'esbuild',
        lib: {
          entry: path.join(uiDir, '.plugin-entry.tsx'),
          fileName: () => process.env.UI_OUT || 'bundle.js',
          formats: ['es'],
        },
        rollupOptions: {
          external: [
            'react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/client', 'lucide-react',
            '@fromcode119/sdk', '@fromcode119/sdk/react', '@fromcode119/sdk/admin',
          ],
          output: { compact: true, inlineDynamicImports: true },
        },
      },
    };
  }
}
