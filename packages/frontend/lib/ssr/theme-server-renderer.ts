import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { RuntimeConstants } from '@fromcode119/core/client';
import { ServerApiUtils } from '@/lib/server-api';
import { ServerApiBridge } from '@/lib/ssr/server-api-bridge';
import { FrontendConfigCache } from '@/lib/frontend-config-cache';
import { ThemePrefetchRequestCache } from '@/lib/theme/theme-prefetch-request-cache';
import { PageDocPrefetchRequestCache } from '@/lib/theme/page-doc-prefetch-request-cache';
import { FrontendTranslationsCache } from '@/lib/frontend-translations-cache';
import { ResolvedContentShape } from '@/lib/resolved-content-shape';
import { ServerPluginContext } from '@/lib/ssr/server-plugin-context';
import { ThemeServerRegistry } from '@/lib/ssr/theme-server-registry';
import { ThemeSsrContentTree } from '@/lib/ssr/theme-ssr-content-tree';
import { ThemeSsrMarkup } from '@/lib/ssr/theme-ssr-markup';
import { ThemeSsrRuntime } from '@/lib/ssr/theme-ssr-runtime';

/**
 * Renders the active theme's layout AND the page's block flow to HTML on the server, so the storefront
 * ships painted pixels — navbar, logo, background, the page's blocks, footer — instead of the empty
 * shell it served before, where every pixel waited on hydration.
 *
 * Two artifacts feed it, both produced by `build-plugins.sh` and both mounted read-only:
 * `themes/<slug>/ui-ssr/entry.mjs` supplies the layouts, `plugins/<slug>/ui-ssr/entry.mjs` supplies the
 * storefront slot components — above all the cms block flow, which owns everything inside the layout.
 * Both register by SIDE EFFECT of import, which is why the bridge is installed first and the imports
 * are awaited before the registry is read.
 *
 * Every failure path returns null, and null means the page renders exactly as it did before this class
 * existed. Server rendering must never be able to take the storefront down.
 */
export class ThemeServerRenderer {
  /** In-flight/completed bundle imports, keyed by path — each bundle is imported ONCE per process. */
  private static readonly imports = new Map<string, Promise<boolean>>();

  private static bootstrap: Promise<ThemeSsrRuntime | null> | null = null;

  static async render(args: {
    content: unknown;
    locale: string;
    contentClassName: string;
    contentStyle: Record<string, string> | null;
  }): Promise<ThemeSsrMarkup | null> {
    try {
      return await ThemeServerRenderer.renderOrThrow(args);
    } catch (error) {
      console.warn('[frontend] Theme server render skipped:', (error as Error)?.message || error);
      return null;
    }
  }

  private static async renderOrThrow(args: {
    content: unknown;
    locale: string;
    contentClassName: string;
    contentStyle: Record<string, string> | null;
  }): Promise<ThemeSsrMarkup | null> {
    const { content, locale, contentClassName, contentStyle } = args;
    // Started before anything is awaited: neither depends on the config or the theme, and both are
    // per-request cached, so kicking them off here overlaps their round-trips with the theme boot
    // instead of adding two more serial hops to TTFB — which is 12% of this page's LCP.
    const translationsRequest = FrontendTranslationsCache.read(locale);
    // BOTH prefetch passes, exactly what the browser receives: the theme's page-agnostic entries (its
    // navigation menus) AND the page-scoped ones. Seeding only the page-scoped half left the theme's
    // navbar and footer reading `null` during render, so they painted their STATIC fallback menu and the
    // real navigation appeared only after the client booted — a visible change on every first load.
    const prefetchRequest = Promise.all([
      ThemePrefetchRequestCache.read(),
      PageDocPrefetchRequestCache.read(content),
    ]).then(([themeWide, pageScoped]) => ({ ...themeWide, ...pageScoped }));

    const config = (await FrontendConfigCache.read()) || {};
    const themeSlug = String((config.activeTheme as Record<string, unknown>)?.slug || '').trim();
    if (!themeSlug) return null;

    const runtime = await ThemeServerRenderer.boot(themeSlug);
    if (!runtime) return null;

    const layouts = ThemeServerRegistry.layoutsFor(themeSlug);
    const layoutName = ResolvedContentShape.resolveLayoutName(content as Record<string, unknown> | null) || 'DefaultLayout';
    const Layout = layouts[layoutName] || layouts.DefaultLayout;
    if (!Layout) return null;

    const [serverTranslations, prefetched] = await Promise.all([translationsRequest, prefetchRequest]);
    const contextValue = ServerPluginContext.build({ themeSlug, config, serverTranslations, locale });

    const body = ThemeSsrContentTree.build({ runtime, content, className: contentClassName, style: contentStyle });
    const tree = runtime.provide(
      runtime.react.createElement(Layout, { page: content }, body),
      {
        context: contextValue,
        slots: contextValue.slots,
        overrides: contextValue.overrides,
        translation: { t: contextValue.t, locale, setLocale: () => undefined },
        settings: contextValue.settings,
        menuItems: contextValue.menuItems,
        collections: contextValue.collections,
        pluginState: { pluginState: contextValue.pluginState, setPluginState: () => undefined },
      },
    );

    const contentSlot = (contextValue.slots as Record<string, unknown[]>)[ThemeServerRenderer.CONTENT_SLOT];
    const html = ThemeServerRenderer.renderWithPrefetch(runtime, tree, prefetched);
    const markup = ThemeSsrMarkup.from(html, Boolean(contentSlot?.length));
    return markup.hasBody ? markup : null;
  }

  /** The slot a plugin fills with the page body — the cms block flow, on every content page. */
  private static readonly CONTENT_SLOT = 'frontend.content.display';

  /**
   * Render with the page's prefetch payload visible on `globalThis`.
   *
   * A theme reads server-prefetched data through `PrefetchedDataService`, which looks the payload up on
   * `globalThis[GLOBALS.PAGE_PREFETCH]` — the browser gets it from the inline script `PageDocPrefetchView`
   * emits. Without it server-side, product-backed components render their empty state and the page's real
   * LCP image (the product photo) is absent from the HTML, so the browser cannot start fetching it until
   * the client has hydrated AND made its own API round-trip.
   *
   * Safe as a global: `renderToStaticMarkup` is synchronous, so nothing else runs between the assignment
   * and the restore, and the previous value is put back in `finally`. The SAME per-request payload
   * `PageDocPrefetchView` injects, from the same React `cache()` — one fetch pass, one source of truth.
   */
  private static renderWithPrefetch(
    runtime: ThemeSsrRuntime,
    tree: unknown,
    prefetched: Record<string, unknown>,
  ): string {
    const globals = globalThis as unknown as Record<string, unknown>;
    const key = RuntimeConstants.GLOBALS.PAGE_PREFETCH;
    const previous = globals[key];
    globals[key] = prefetched;
    try {
      return runtime.renderToStaticMarkup(tree);
    } finally {
      globals[key] = previous;
    }
  }

  /**
   * One-time, process-wide: load the runtime module world, install the capturing bridge, import the
   * theme and every plugin that ships a storefront server bundle, then resolve the lazily-registered
   * block renderers. Returns null when the theme itself could not be loaded — without layouts there is
   * nothing to render into.
   */
  private static boot(themeSlug: string): Promise<ThemeSsrRuntime | null> {
    ThemeServerRenderer.bootstrap ||= ThemeServerRenderer.bootOnce(themeSlug);
    return ThemeServerRenderer.bootstrap;
  }

  private static async bootOnce(themeSlug: string): Promise<ThemeSsrRuntime | null> {
    const runtime = await ThemeSsrRuntime.load();
    // The PUBLIC api base, not the internal one: plugin clients bake it into `<img src>` / `srcset`
    // attributes that the BROWSER then requests, so it has to be the URL a visitor can reach.
    ThemeServerRegistry.install(runtime.contextBridge, new ServerApiBridge(ServerApiUtils.buildPublicApiBaseUrl()));

    const themeEntry = join(ThemeSsrRuntime.themesDir(), themeSlug, 'ui-ssr', 'entry.mjs');
    if (!(await ThemeServerRenderer.importBundle(themeEntry))) return null;
    if (!ThemeServerRegistry.payloadFor(themeSlug)) return null;

    // Plugins are imported AFTER the theme so a theme override, registered at the higher priority,
    // still wins — the browser load order this mirrors is the same.
    await Promise.all(ThemeServerRenderer.pluginEntries().map((entry) => ThemeServerRenderer.importBundle(entry)));
    await ThemeServerRegistry.warmOverrides();
    return runtime;
  }

  /** Every `plugins/<slug>/ui-ssr/entry.mjs` on disk. A plugin without one simply renders client-side. */
  private static pluginEntries(): string[] {
    const pluginsDir = ThemeSsrRuntime.pluginsDir();
    if (!pluginsDir || !existsSync(pluginsDir)) return [];
    return readdirSync(pluginsDir, { withFileTypes: true })
      .filter((item) => item.isDirectory())
      .map((item) => join(pluginsDir, item.name, 'ui-ssr', 'entry.mjs'))
      .filter((entry) => existsSync(entry));
  }

  private static importBundle(entry: string): Promise<boolean> {
    const cached = ThemeServerRenderer.imports.get(entry);
    if (cached) return cached;

    const started = ThemeServerRenderer.importBundleOnce(entry);
    ThemeServerRenderer.imports.set(entry, started);
    return started;
  }

  private static async importBundleOnce(entry: string): Promise<boolean> {
    if (!existsSync(entry)) return false;
    try {
      await ThemeSsrRuntime.importRuntimeModule(entry);
      return true;
    } catch (error) {
      // One bundle that will not load server-side must not cost the page the rest of them.
      console.warn(`[frontend] SSR bundle not loaded (${entry}):`, (error as Error)?.message || error);
      return false;
    }
  }
}
