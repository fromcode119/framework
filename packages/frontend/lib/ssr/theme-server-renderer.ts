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
import { ThemeSsrGeneration } from '@/lib/ssr/theme-ssr-generation';
import { ThemeSsrMarkup } from '@/lib/ssr/theme-ssr-markup';
import { ThemeSsrRuntime } from '@/lib/ssr/theme-ssr-runtime';

/**
 * Renders the active theme's layout AND the page's block flow to HTML on the server, so the storefront
 * ships painted pixels — navbar, logo, background, the page's blocks, footer — instead of the empty
 * shell it served before, where every pixel waited on hydration.
 *
 * Two artifacts feed it, both produced by `build-plugins.sh` and both mounted read-only:
 * `themes/<slug>/ui-ssr/entry.mjs` supplies the layouts, `plugins/<slug>/ui-ssr/entry.mjs` supplies the
 * storefront slot components — above all the content block flow, which owns everything inside the layout.
 * Both register by SIDE EFFECT of import, which is why the bridge is installed first and the imports
 * are awaited before the registry is read.
 *
 * Every failure path returns null, and null means the page renders exactly as it did before this class
 * existed. Server rendering must never be able to take the storefront down.
 */
export class ThemeServerRenderer {
  /**
   * Counts boots, and every bundle URL carries the count.
   *
   * Node's ESM cache is keyed by URL and a cached module does NOT re-run — and registration is a side
   * effect of running. A generation is published from an EMPTY registry, so any bundle Node answered
   * from cache would simply be missing from the new world. Keying the URL on the version alone was not
   * enough: reverting to a version this process had already booted replayed the cached modules,
   * nothing registered, and the storefront went back to serving an empty body. The counter makes every
   * boot's URLs new, so the registrations always run.
   */
  private static boots = 0;

  private static bootstrap: Promise<ThemeSsrRuntime | null> | null = null;

  /** The artifact versions {@link bootstrap} was built from. A different one means a rebuild is due. */
  private static booted: ThemeSsrGeneration | null = null;

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
    // The installed artifact versions, read off the config this render already needed — no extra fetch.
    const generation = ThemeSsrGeneration.from(config);
    const themeSlug = generation.themeSlug;
    if (!themeSlug) return null;

    const runtime = await ThemeServerRenderer.boot(generation);
    if (!runtime) return null;

    const layouts = ThemeServerRegistry.layoutsFor(themeSlug);
    // The theme DECLARES its default layout (theme.json `defaultLayout`); the framework does not guess a
    // name. This used to fall back to a hardcoded 'DefaultLayout' that no theme declares — it only ever
    // resolved because a theme aliased that literal onto a real layout behind the operator's back.
    const declaredDefault = String((config.activeTheme as Record<string, unknown> | null)?.defaultLayout || '');
    const layoutName = ResolvedContentShape.resolveLayoutName(content as Record<string, unknown> | null) || declaredDefault;
    const Layout = layouts[layoutName] || (declaredDefault ? layouts[declaredDefault] : undefined);
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
        // The server twin of what `PluginRuntimeProvider.read()` publishes in the browser. Shape must
        // track `PluginRuntimeValue`: `plugins` is the plugin-context registry value (what
        // `ContextHooks.usePlugins()` returns), `globalSettings` the settings context.
        pluginRuntime: {
          plugins: contextValue,
          translation: { t: contextValue.t, locale, setLocale: () => undefined },
          globalSettings: contextValue.settings,
          collections: contextValue.collections,
          locale,
          api: null,
        },
      },
    );

    const contentSlot = (contextValue.slots as Record<string, unknown[]>)[ThemeServerRenderer.CONTENT_SLOT];
    const html = ThemeServerRenderer.renderWithPrefetch(runtime, tree, prefetched);
    const markup = ThemeSsrMarkup.from(html, Boolean(contentSlot?.length));
    return markup.hasBody ? markup : null;
  }

  /** The slot a plugin fills with the page body — the content block flow, on every content page. */
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
   * Load the runtime module world, install the capturing bridge, import the theme and every plugin that
   * ships a storefront server bundle, then resolve the lazily-registered block renderers. Returns null
   * when the theme itself could not be loaded — without layouts there is nothing to render into.
   *
   * Done ONCE per set of installed artifact versions rather than once per process. Keying it by version
   * is what makes a theme or plugin update take effect on the storefront: before this, an install had to
   * be followed by an SSH `docker restart` or the frontend went on rendering the bundles it imported at
   * boot — and if the artifact had not existed then, went on rendering nothing at all.
   */
  private static boot(generation: ThemeSsrGeneration): Promise<ThemeSsrRuntime | null> {
    // Swapped synchronously, before the first await, so concurrent requests share one rebuild.
    if (!ThemeServerRenderer.bootstrap || !generation.matches(ThemeServerRenderer.booted)) {
      ThemeServerRenderer.booted = generation;
      ThemeServerRenderer.bootstrap = ThemeServerRenderer.bootOnce(generation);
    }
    return ThemeServerRenderer.bootstrap;
  }

  private static async bootOnce(generation: ThemeSsrGeneration): Promise<ThemeSsrRuntime | null> {
    ThemeServerRenderer.boots += 1;
    // Unique to this boot, so no bundle can be answered from Node's module cache. See `boots`.
    const cacheBuster = `${generation.token}-${ThemeServerRenderer.boots}`;
    const runtime = await ThemeSsrRuntime.load();
    // The PUBLIC api base, not the internal one: plugin clients bake it into `<img src>` / `srcset`
    // attributes that the BROWSER then requests, so it has to be the URL a visitor can reach.
    ThemeServerRegistry.install(runtime.contextBridge, new ServerApiBridge(ServerApiUtils.buildPublicApiBaseUrl()));

    // Everything the re-imported bundles register lands here, not in the live state, until the whole
    // generation is built — so requests arriving mid-rebuild keep rendering against the previous world
    // instead of a half-populated one.
    const state = ThemeServerRegistry.beginGeneration();
    const themeSlug = generation.themeSlug;
    const themeEntry = join(ThemeSsrRuntime.themesDir(), themeSlug, 'ui-ssr', 'entry.mjs');
    if (!(await ThemeServerRenderer.importBundle(themeEntry, cacheBuster))
      || !state.payloadFor(themeSlug)) {
      ThemeServerRegistry.discardGeneration(state);
      // Say so, LOUDLY. Without the theme's server bundle there is no server rendering AT ALL — every
      // page ships a content-free body — and until this line existed that catastrophic state looked
      // exactly like a healthy boot: no error, no warning, just empty HTML. A theme packaged by tooling
      // that drops `ui-ssr/**` produces precisely this, and it cost two production deploys to spot.
      console.error(
        `[frontend] NO SERVER RENDERING: active theme "${themeSlug}" registered no layouts from ` +
        `${themeEntry}. Every page will serve an empty body until the theme package ships that bundle.`,
      );
      return null;
    }

    // Plugins are imported AFTER the theme so a theme override, registered at the higher priority,
    // still wins — the browser load order this mirrors is the same.
    await Promise.all(
      ThemeServerRenderer.pluginEntries().map((entry) => ThemeServerRenderer.importBundle(entry, cacheBuster)),
    );
    await state.warmOverrides();
    ThemeServerRegistry.publishGeneration(state);
    console.info(`[frontend] SSR bundles loaded for ${generation.signature}`);
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

  /**
   * Import one bundle for this boot. There is deliberately NO cache in front of this: `bootOnce` runs
   * once per generation and asks for each bundle once, so a memo would only ever serve a STALE answer
   * across boots — including the "this file does not exist" answer that kept the frontend rendering
   * nothing after a theme update had already fixed it.
   */
  private static async importBundle(entry: string, cacheBuster: string): Promise<boolean> {
    if (!existsSync(entry)) return false;
    try {
      await ThemeSsrRuntime.importRuntimeModule(entry, cacheBuster);
      return true;
    } catch (error) {
      // One bundle that will not load server-side must not cost the page the rest of them.
      console.warn(`[frontend] SSR bundle not loaded (${entry}):`, (error as Error)?.message || error);
      return false;
    }
  }
}
