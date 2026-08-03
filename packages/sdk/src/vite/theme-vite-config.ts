import react from '@vitejs/plugin-react';
import autoprefixer from 'autoprefixer';
import externalGlobals from 'rollup-plugin-external-globals';
import fs from 'node:fs';
import path from 'node:path';
import type { UserConfig } from 'vite';
import { FromcodeThemeOverridesPlugin } from './fromcode-theme-overrides-plugin';
import { ThemeEntryGenerator } from './theme-entry-generator';

/**
 * Shared, framework-owned Vite config for building ANY theme's client bundle. One config for every theme —
 * driven by env (THEME_DIR, THEME_SLUG), so a theme ships NO build config of its own (no vite.config,
 * tailwind/postcss, build script). Unlike the plugin config, a theme's CSS is PROCESSED normally (bundled +
 * autoprefixed), not inlined as raw text. react / @fromcode119/sdk stay external (resolved at runtime by
 * the frontend import map). A theme is just: src/ components + theme.json + styles + public/.
 *
 * Vite requires the config module to DEFAULT-export its object. That single required export is generated
 * as build glue (see nextor's `ViteConfigEntryGenerator`) so the authored source stays a plain class.
 */
export class ThemeViteConfig {
  /**
   * The single runtime handoff surface. MUST match `RuntimeConstants.GLOBALS.MODULES` — the theme bundle
   * loads with NO import map, so its externals are rewritten to read this ONE namespaced registry directly
   * (no `window.Fromcode` / `window.React` / `window.ReactDOM`). rollup-plugin-external-globals substitutes
   * the target string verbatim, so a bracketed member expression is a valid global-name target.
   */
  private static readonly RUNTIME_REGISTRY = "window['__fromcodeRuntimeModules']";

  private static get bridgeGlobal(): string {
    return `${ThemeViteConfig.RUNTIME_REGISTRY}['@fromcode119/react']`;
  }

  /**
   * Domain-specific vendor chunking belongs to the THEME, not the framework. A theme declares it in its
   * `theme.json`, e.g. `"vendorChunks": { "vendor-stripe": ["@stripe"] }` — so a payment/courier/business
   * vendor is never named in framework code. Unreadable or malformed input yields no extra chunks.
   */
  private static readVendorChunks(dir: string): Record<string, string[]> {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(dir, 'theme.json'), 'utf8'))?.vendorChunks;
      if (!parsed || typeof parsed !== 'object') return {};
      const out: Record<string, string[]> = {};
      for (const [name, matchers] of Object.entries(parsed as Record<string, unknown>)) {
        if (Array.isArray(matchers)) {
          const list = matchers.map((m) => String(m).trim()).filter(Boolean);
          if (list.length) out[name] = list;
        }
      }
      return out;
    } catch {
      return {};
    }
  }

  /** Split heavy vendor libs into cacheable chunks — UI/runtime libraries only, never a business vendor. */
  private static chunkFor(id: string, extra: Record<string, string[]>): string | undefined {
    if (!id.includes('node_modules')) return undefined;
    for (const [chunkName, matchers] of Object.entries(extra)) {
      if (matchers.some((m) => id.includes(m))) return chunkName;
    }
    if (id.includes('@chakra-ui') || id.includes('@emotion')) return 'vendor-chakra';
    if (id.includes('framer-motion') || id.includes('popmotion') || id.includes('@motionone') || id.includes('style-value-types')) return 'vendor-motion';
    if (id.includes('lucide-react') || id.includes('react-icons')) return 'vendor-icons';
    return 'vendor';
  }

  static create(): UserConfig {
    const themeDir = process.env.THEME_DIR as string;
    const themeSlug = process.env.THEME_SLUG || 'theme';
    const extraVendorChunks = ThemeViteConfig.readVendorChunks(themeDir);
    const registry = ThemeViteConfig.RUNTIME_REGISTRY;
    const bridge = ThemeViteConfig.bridgeGlobal;

    return {
      plugins: [
        react({ jsxRuntime: 'automatic' }),
        FromcodeThemeOverridesPlugin.create({ themeSlug, priority: 11 }),
      ],
      define: { 'process.env.NODE_ENV': JSON.stringify('production') },
      // Vendor-prefix the theme's CSS in the framework build (autoprefixer) so every theme gets correct
      // cross-browser prefixes with ZERO per-theme postcss config. This is generic CSS tooling, not business
      // logic — it belongs in the shared build. Tailwind is intentionally NOT here: themes author plain CSS.
      css: { postcss: { plugins: [autoprefixer()] } },
      // Copy the THEME's own public assets into the bundle. Point at the theme's public/ explicitly — NOT
      // Vite's default (which, run from the framework cwd, would copy the dev site's media into every
      // theme), and NOT `false` (which would drop assets theme.json references).
      publicDir: path.join(themeDir, 'public'),
      // Decorators are LEGACY (`experimentalDecorators`), matching reactor's `@prop(target, key)` /
      // `@state` signatures — the same setting the plugin-UI config carries. Vite compiles the theme's
      // sources with esbuild and does NOT read the theme's tsconfig, so without this a `@prop` in a theme
      // component is a parse error ("Unexpected token. Expected * for generator, private key, identifier
      // or async") and the whole theme build dies. `useDefineForClassFields: false` because a defined
      // field would shadow the accessor the decorator installs.
      esbuild: {
        tsconfigRaw: {
          compilerOptions: { experimentalDecorators: true, useDefineForClassFields: false },
        },
      },
      build: {
        outDir: path.join(themeDir, 'ui'),
        emptyOutDir: true,
        target: 'es2022',
        minify: 'esbuild',
        commonjsOptions: { include: [/node_modules/], transformMixedEsModules: true },
        lib: {
          // GENERATED by `nextor theme-entry` from theme.json — a theme ships no entry file and no
          // build config. See ThemeEntryGenerator for why this is a real file rather than a virtual module.
          entry: ThemeEntryGenerator.resolveEntry(themeDir),
          fileName: () => 'bundle.js',
          formats: ['es'],
        },
        rollupOptions: {
          external: [
            'react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/client',
            '@fromcode119/sdk', '@fromcode119/sdk/react', '@fromcode119/sdk/admin', '@fromcode119/sdk/admin/theme-style-variant-select', '@fromcode119/sdk/client/default-design',
          ],
          // The theme bundle is loaded by the frontend via a plain dynamic import() with NO import map, so
          // it must contain ZERO bare specifiers — rewrite every external to read the ONE runtime registry
          // the frontend exposes. (Dropping this shipped a bare `import "@fromcode119/sdk/react"` which the
          // theme loader cannot resolve → the theme fails to boot. Plugins use the document import map,
          // a different loader reading the same registry.)
          plugins: [
            externalGlobals({
              react: `${registry}['react']`,
              'react/jsx-runtime': `${registry}['react/jsx-runtime']`,
              'react/jsx-dev-runtime': `${registry}['react/jsx-runtime']`,
              'react-dom': `${registry}['react-dom']`,
              'react-dom/client': `${registry}['react-dom']`,
              '@fromcode119/sdk': bridge,
              '@fromcode119/sdk/react': bridge,
              '@fromcode119/sdk/admin': bridge,
              // Direct subpath: the theme imports ThemeStyleVariantSelect from its OWN module rather than
              // the sdk/admin barrel, so that the theme stays loadable on the SERVER (the barrel pulls in
              // @fromcode119/admin/components, which has no Node implementation). The browser still reads
              // it from the one runtime registry, exactly like the barrel.
              '@fromcode119/sdk/admin/theme-style-variant-select': bridge,
              '@fromcode119/sdk/client/default-design': bridge,
            }),
          ],
          output: {
            compact: true,
            manualChunks: (id: string) => ThemeViteConfig.chunkFor(id, extraVendorChunks),
            chunkFileNames: '[name]-[hash].js',
            // The single bundled CSS (from JS imports) must land as `<slug>-theme.css` — the name
            // theme.json loads. Match on the `.css` extension (not the literal `style.css`, whose name
            // varies by cwd). Public assets are copied verbatim by publicDir and never reach this hook.
            assetFileNames: (info: { name?: string }) => (info.name?.endsWith('.css') ? `${themeSlug}-theme.css` : '[name].[ext]'),
          },
        },
      },
      resolve: { alias: { '@theme': path.join(themeDir, 'src') } },
    };
  }
}
