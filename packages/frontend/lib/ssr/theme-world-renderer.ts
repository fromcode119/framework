// The SOURCE module, NOT the package barrel, and this is load-bearing rather than tidiness.
// `@fromcode119/react`'s index re-exports `ShellBoundary`, which extends reactor's `Component`. This
// file is reached from an App Route, so importing the barrel pulled a CLASS COMPONENT into the Server
// Component graph and Next refused to build the frontend at all ("You're importing a class component.
// It only works in a Client Component..."). Nothing here ever wanted the shells; the barrel simply
// dragged them in. Importing the one module directly is also what the codebase's own rule asks for —
// consumers import from the actual source file, never through a re-export barrel.
import { PluginNavigation } from '@fromcode119/react/plugin-navigation';
import { PagePrefetch, RenderLocationUtils } from '@fromcode119/core/client';
import type { IRenderLocation } from '@fromcode119/core/client';
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
    const { runtime, signature, themeSlug, config, serverTranslations, prefetched, content, locale, contentClassName, contentStyle, notFoundPath, requestPath, requestOrigin, requestSearch } = args;
    const layouts = ThemeServerRegistry.layoutsFor(signature, themeSlug);
    // The theme DECLARES its default layout (theme.json `defaultLayout`); the framework does not guess a
    // name. This used to fall back to a hardcoded 'DefaultLayout' that no theme declares — it only ever
    // resolved because a theme aliased that literal onto a real layout behind the operator's back.
    const declaredDefault = String((config.activeTheme as Record<string, unknown> | null)?.defaultLayout || '');
    const layoutName = ResolvedContentShape.resolveLayoutName(content as Record<string, unknown> | null) || declaredDefault;
    const Layout = layouts[layoutName] || (declaredDefault ? layouts[declaredDefault] : undefined);
    if (!Layout) return null;

    const contextValue = ServerPluginContext.build({
      signature,
      themeSlug,
      config,
      serverTranslations,
      frameworkTranslations: runtime.frameworkTranslationPacks(),
      locale,
    });
    const body = ThemeSsrContentTree.build({
      runtime, content, className: contentClassName, style: contentStyle, notFoundPath, locale,
      transform: ThemeServerRegistry.contentTransform(signature),
      recipeComponent: ThemeWorldRenderer.recipeComponent(runtime, content, themeSlug),
    });
    const translation = { t: contextValue.t, locale, setLocale: () => undefined };
    const tree = runtime.provide(
      // The page-wide overlay BESIDE the layout, as `StorefrontPageView` renders it in the browser.
      runtime.react.createElement(
        runtime.react.Fragment,
        null,
        runtime.react.createElement(Layout, { key: 'layout', page: content }, body),
        runtime.react.createElement(runtime.frameworkReact.Slot, { key: 'overlay', name: StorefrontContentContract.OVERLAY_SLOT }),
      ),
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
          // A server render has nowhere to navigate TO — but the field must exist, because the value
          // is typed as PluginRuntimeValue and a plugin reading `this.navigation` during SSR would
          // otherwise get undefined. The no-host navigator is inert on the server by design.
          navigation: new PluginNavigation(),
        },
      },
    );

    const contentSlot = (contextValue.slots as Record<string, unknown[]>)[StorefrontContentContract.DISPLAY_SLOT];
    // The runtime's OWN tracker instance (dist), the one its Slot/Override report to; renderToString is
    // synchronous, so the set belongs to this render alone.
    const tracker = runtime.frameworkReact.PluginUsageTracker;
    tracker?.reset?.();
    const html = ThemeWorldRenderer.renderWithPrefetch(runtime, tree, prefetched, { path: requestPath, origin: requestOrigin, search: requestSearch || '' });
    const usedPlugins: string[] = tracker?.drain?.() ?? [];
    // A `recipe` page's body is an empty box (`ThemeSsrContentTree`): the display slot was never
    // rendered, however many components are registered to it. Claiming otherwise made the browser hold
    // the server markup until a display-slot component registered — which, on a site running no plugin
    // that fills that slot, never happened, so the plugin's design never replaced the empty box.
    const rendersContentSlot = !(content as Record<string, unknown> | null)?.recipe && Boolean(contentSlot?.length);
    const translationPaths = (contextValue.translationPaths as () => string[])();
    const markup = ThemeSsrMarkup.from(html, rendersContentSlot, usedPlugins, translationPaths);
    return markup.hasBody ? markup : null;
  }

  /**
   * Render with the page's prefetch payload and address in scope.
   *
   * A theme reads server-prefetched data through `PagePrefetch.get(key)` — the browser gets it from the
   * JSON block `PagePrefetchScriptView` emits — and the page address through `RenderLocationUtils`.
   * Without them server-side, product-backed components render their empty state and the page's real LCP
   * image (the product photo) is absent from the HTML.
   *
   * Both are module-scoped, never `globalThis`: `renderToString` is synchronous, so the scope is exactly
   * the render. They are set on BOTH core instances that can be reached during it — the one this process
   * bundled and the one the theme/plugin bundles `require` — since each holds its own scope.
   */
  private static renderWithPrefetch(
    runtime: ThemeSsrRuntime,
    tree: unknown,
    prefetched: Record<string, unknown>,
    location: IRenderLocation,
  ): string {
    const shared = runtime.frameworkCore as { PagePrefetch: typeof PagePrefetch; RenderLocationUtils: typeof RenderLocationUtils };
    const render = () => runtime.renderToString(tree) as string;
    return PagePrefetch.renderWith(prefetched, () => RenderLocationUtils.renderAt(location, () =>
      shared.PagePrefetch.renderWith(prefetched, () => shared.RenderLocationUtils.renderAt(location, render))));
  }

  /**
   * The default page design a `recipe` page resolves to — the same lookup `DefaultPageDesignRenderer`
   * makes in the browser, against the registry the plugin bundles filled in this process. Null when
   * the page has no recipe or nothing is registered for it.
   */
  static recipeComponent(runtime: ThemeSsrRuntime, content: unknown, themeSlug: string): unknown {
    const recipe = String((content as Record<string, unknown> | null)?.recipe || '').trim();
    if (!recipe) return null;
    const core = runtime.frameworkCore;
    const resolved = core.CoreServices.getInstance().defaultDesignRuntimeBridge.resolvePageTarget(recipe, themeSlug || undefined);
    return resolved?.status === core.LayoutResolutionStatus.RESOLVED ? resolved.winner ?? null : null;
  }
}
