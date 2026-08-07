import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { EnvUtils } from '@fromcode119/core/client';

/**
 * The module world a theme's SSR bundle actually runs in — deliberately NOT the one Next bundles.
 *
 * Two resolution facts drive this class, and getting either wrong silently breaks server rendering:
 *
 * 1. **Next bundles `@fromcode119/react` from SOURCE** (`next.config.js` aliases it to `../react/src`),
 *    while `themes/<slug>/ui-ssr/entry.mjs` resolves the same specifier through node_modules to
 *    `packages/react/dist`. Those are two distinct `ContextBridge` classes. Installing the bridge on
 *    the bundled copy therefore captures NOTHING — the theme registers into the other one. So the
 *    bridge, the context Provider, and the render call are all taken from the RUNTIME copy, loaded
 *    here via `createRequire` (which no bundler rewrites).
 *
 * 2. **A theme ships its own `node_modules/react`.** Chakra and emotion inside the theme bundle
 *    resolve to it, so their hooks read a different dispatcher than the one driving the render and
 *    every component throws `Cannot read properties of null (reading 'useMemo')`. React must be a
 *    singleton, so a resolve hook rewrites `react` / `react-dom` / `scheduler` to the framework's copy
 *    for every import originating under the themes directory — and only there, so nothing else in the
 *    process changes resolution.
 *
 * Loaded once per process; the promise itself is the cache.
 */
export class ThemeSsrRuntime {
  /** `react` — the framework's single instance, shared with the theme bundle by the resolve hook. */
  readonly react: any; // eslint-disable-line @typescript-eslint/no-explicit-any

  /** `react-dom/server`'s `renderToStaticMarkup`, bound to the same React instance. */
  readonly renderToStaticMarkup: (element: unknown) => string;

  /** The `ContextBridge` the THEME registers into — `packages/react/dist`, not Next's bundled source. */
  readonly contextBridge: any; // eslint-disable-line @typescript-eslint/no-explicit-any

  /**
   * The `@fromcode119/react` module itself — `PluginContextRegistry`, `Slot`, and the standalone
   * `SlotsContext` / `OverridesContext` / `TranslationContext` that `Slot` and `Override` read directly
   * rather than through the plugin context. All from the copy the bundles use, so provider and consumer
   * are the same context object.
   */
  readonly frameworkReact: any; // eslint-disable-line @typescript-eslint/no-explicit-any

  private static instance: Promise<ThemeSsrRuntime> | null = null;

  private static hooksInstalled = false;

  private constructor(
    react: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    renderToStaticMarkup: (element: unknown) => string,
    frameworkReact: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  ) {
    this.react = react;
    this.renderToStaticMarkup = renderToStaticMarkup;
    this.frameworkReact = frameworkReact;
    this.contextBridge = frameworkReact.ContextBridge;
  }

  /** Absolute path of the mounted themes directory (`THEMES_DIR`), or `''` when unmounted. */
  static themesDir(): string {
    return EnvUtils.text('THEMES_DIR');
  }

  /** Absolute path of the mounted plugins directory (`PLUGINS_DIR`), or `''` when unmounted. */
  static pluginsDir(): string {
    return EnvUtils.text('PLUGINS_DIR');
  }

  /** Idempotent, process-wide. Rejects when the runtime copies cannot be resolved. */
  static load(): Promise<ThemeSsrRuntime> {
    ThemeSsrRuntime.instance ||= ThemeSsrRuntime.build();
    return ThemeSsrRuntime.instance;
  }

  /**
   * Import a module by absolute path through Node's own ESM loader.
   *
   * The magic comments are load-bearing: without them the bundler tries to resolve a theme path that
   * exists only at runtime, in a directory that is not part of the build.
   */
  static importRuntimeModule(absolutePath: string): Promise<Record<string, unknown>> {
    return import(/* webpackIgnore: true */ /* turbopackIgnore: true */ pathToFileURL(absolutePath).href);
  }

  private static async build(): Promise<ThemeSsrRuntime> {
    // Anchor every runtime resolution on `@fromcode119/react`'s own location: that package is what the
    // theme bundle imports, so resolving React the way IT does is what makes the instances identical.
    const appRequire = createRequire(`${process.cwd()}/`);
    const frameworkReactEntry = appRequire.resolve('@fromcode119/react');
    const frameworkRequire = createRequire(frameworkReactEntry);

    ThemeSsrRuntime.installResolveHook(frameworkRequire);

    const react = frameworkRequire('react');
    const reactDomServer = frameworkRequire('react-dom/server');
    const frameworkReact = appRequire('@fromcode119/react');

    return new ThemeSsrRuntime(react, reactDomServer.renderToStaticMarkup, frameworkReact);
  }

  /**
   * Wrap `tree` in EVERY provider `PluginsProviderInternal.present` publishes in the browser — not just
   * the plugin context.
   *
   * Several of these are read directly rather than through the plugin context: `Slot`/`Override` consume
   * `SlotsContext`/`OverridesContext`, and `ContextHooks.useGlobalSettings()` consumes `SettingsContext`.
   * A missing provider does not throw — the consumer silently gets the context DEFAULT, so the server
   * renders a component's default state and the browser then replaces it with the real one. That is
   * visible as the design changing after load: with `SettingsContext` absent the storefront painted an
   * "add to cart" button on a store whose settings have `allowAddToCart: false`, and dropped it a second
   * later. Keep this list in step with `present()`.
   *
   * `PluginRuntimeContext` is the same class of bug and was missing for the same reason. Every hook-free
   * plugin UI class (`PluginComponent`) declares it as its `contextType` and reads `this.t` off it; the
   * browser mounts it via `PluginRuntimeProvider` inside `RootProvider`, but nothing mounted it here. So
   * server-side `this.context` was undefined and `this.t` fell back to identity, printing RAW KEYS into
   * the HTML — `aria-label="ecommerce.collection.loading"` shipped on every storefront page's first
   * paint. It takes a value shaped like `PluginRuntimeValue`, and its provider is reached through
   * `.context` (a reactor `Context`), not the `.Context` the framework's own context objects expose.
   */
  provide(tree: unknown, values: {
    context: unknown;
    slots: unknown;
    overrides: unknown;
    translation: unknown;
    settings: unknown;
    menuItems: unknown;
    collections: unknown;
    pluginState: unknown;
    pluginRuntime: unknown;
  }): unknown {
    const fc = this.frameworkReact;
    const { createElement } = this.react;
    const wrap = (Context: { Context: { Provider: unknown } }, value: unknown, child: unknown) =>
      createElement(Context.Context.Provider, { value }, child);

    // Innermost, so it sees the same values every other provider publishes.
    const withPluginRuntime = createElement(
      fc.PluginRuntimeContext.context.Provider,
      { value: values.pluginRuntime },
      tree,
    );

    return wrap(fc.SlotsContext, values.slots,
      wrap(fc.OverridesContext, values.overrides,
        wrap(fc.TranslationContext, values.translation,
          wrap(fc.PluginStateContext, values.pluginState,
            wrap(fc.CollectionsContext, values.collections,
              wrap(fc.MenuContext, values.menuItems,
                wrap(fc.SettingsContext, values.settings,
                  createElement(fc.PluginContextRegistry.Context.Provider, { value: values.context }, withPluginRuntime))))))));
  }

  private static installResolveHook(frameworkRequire: NodeRequire): void {
    if (ThemeSsrRuntime.hooksInstalled) return;
    ThemeSsrRuntime.hooksInstalled = true;

    // Both mounted extension roots: a theme and a plugin each ship their own node_modules, and either
    // one's React would be a second instance.
    const prefixes = [ThemeSsrRuntime.themesDir(), ThemeSsrRuntime.pluginsDir()]
      .filter(Boolean)
      .map((dir) => pathToFileURL(`${dir.replace(/\/+$/, '')}/`).href);
    if (!prefixes.length) return;

    const reactSpecifier = /^(react|react-dom|scheduler)(\/.*)?$/;

    registerHooks({
      resolve(specifier, context, nextResolve) {
        const parentUrl = String(context.parentURL || '');
        if (reactSpecifier.test(specifier) && prefixes.some((prefix) => parentUrl.startsWith(prefix))) {
          return { url: pathToFileURL(frameworkRequire.resolve(specifier)).href, shortCircuit: true };
        }
        return nextResolve(specifier, context);
      },
    });
  }
}
