import { RuntimeConstants } from '@fromcode119/core/client';
import { ResolvedContentShape } from '@/lib/resolved-content-shape';
import { ServerPluginContext } from '@/lib/ssr/server-plugin-context';
import { ThemeServerRegistry } from '@/lib/ssr/theme-server-registry';
import { ThemeSsrContentTree } from '@/lib/ssr/theme-ssr-content-tree';
import { ThemeSsrMarkup } from '@/lib/ssr/theme-ssr-markup';
import { ThemeSsrRuntime } from '@/lib/ssr/theme-ssr-runtime';
import { StorefrontContentContract } from '@/lib/storefront-content-contract';
import type { IThemeRenderRequest } from '@/lib/ssr/host/interfaces/theme-render-request.interface';

/**
 * Renders one page against a BUILT world: the theme's layout around the page's block flow, with every
 * provider the browser publishes, to hydratable HTML split into head-bound and body parts.
 *
 * Pure with respect to process: it reads the world from the registry under the given signature and the
 * page from the request, so it runs identically inside a theme render host and inside the storefront.
 */
export class ThemeWorldRenderer {
  static render(args: { runtime: ThemeSsrRuntime; signature: string; themeSlug: string } & IThemeRenderRequest): ThemeSsrMarkup | null {
    const { runtime, signature, themeSlug, config, serverTranslations, prefetched, content, locale, contentClassName, contentStyle, notFoundPath } = args;
    const layouts = ThemeServerRegistry.layoutsFor(signature, themeSlug);
    // The theme DECLARES its default layout (theme.json `defaultLayout`); the framework does not guess a
    // name. This used to fall back to a hardcoded 'DefaultLayout' that no theme declares — it only ever
    // resolved because a theme aliased that literal onto a real layout behind the operator's back.
    const declaredDefault = String((config.activeTheme as Record<string, unknown> | null)?.defaultLayout || '');
    const layoutName = ResolvedContentShape.resolveLayoutName(content as Record<string, unknown> | null) || declaredDefault;
    const Layout = layouts[layoutName] || (declaredDefault ? layouts[declaredDefault] : undefined);
    if (!Layout) return null;

    const contextValue = ServerPluginContext.build({ signature, themeSlug, config, serverTranslations, locale });
    const body = ThemeSsrContentTree.build({ runtime, content, className: contentClassName, style: contentStyle, notFoundPath });
    const translation = { t: contextValue.t, locale, setLocale: () => undefined };
    const tree = runtime.provide(
      runtime.react.createElement(Layout, { page: content }, body),
      {
        context: contextValue,
        slots: contextValue.slots,
        overrides: contextValue.overrides,
        translation,
        settings: contextValue.settings,
        menuItems: contextValue.menuItems,
        collections: contextValue.collections,
        pluginState: { pluginState: contextValue.pluginState, setPluginState: () => undefined },
        // The server twin of what `PluginRuntimeProvider.read()` publishes in the browser. Shape must
        // track `PluginRuntimeValue`: `plugins` is the plugin-context registry value (what
        // `ContextHooks.usePlugins()` returns), `globalSettings` the settings context.
        pluginRuntime: {
          plugins: contextValue,
          translation,
          globalSettings: contextValue.settings,
          collections: contextValue.collections,
          locale,
          api: null,
        },
      },
    );

    const contentSlot = (contextValue.slots as Record<string, unknown[]>)[StorefrontContentContract.DISPLAY_SLOT];
    // The runtime's OWN tracker instance (dist), the one its Slot/Override report to; renderToString is
    // synchronous, so the set belongs to this render alone.
    const tracker = runtime.frameworkReact.PluginUsageTracker;
    tracker?.reset?.();
    const html = ThemeWorldRenderer.renderWithPrefetch(runtime, tree, prefetched);
    const usedPlugins: string[] = tracker?.drain?.() ?? [];
    const markup = ThemeSsrMarkup.from(html, Boolean(contentSlot?.length), usedPlugins);
    return markup.hasBody ? markup : null;
  }

  /**
   * Render with the page's prefetch payload visible on `globalThis`.
   *
   * A theme reads server-prefetched data through `PrefetchedDataService`, which looks the payload up on
   * `globalThis[GLOBALS.PAGE_PREFETCH]` — the browser gets it from the inline script `PageDocPrefetchView`
   * emits. Without it server-side, product-backed components render their empty state and the page's real
   * LCP image (the product photo) is absent from the HTML, so the browser cannot start fetching it until
   * the client has hydrated AND made its own API round-trip.
   *
   * Safe as a global: `renderToString` is synchronous, so nothing else runs between the assignment
   * and the restore, and the previous value is put back in `finally`.
   */
  private static renderWithPrefetch(runtime: ThemeSsrRuntime, tree: unknown, prefetched: Record<string, unknown>): string {
    const globals = globalThis as unknown as Record<string, unknown>;
    const key = RuntimeConstants.GLOBALS.PAGE_PREFETCH;
    const previous = globals[key];
    globals[key] = prefetched;
    try {
      return runtime.renderToString(tree);
    } finally {
      globals[key] = previous;
    }
  }
}
