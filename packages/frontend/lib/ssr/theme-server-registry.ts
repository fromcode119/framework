import { ServerSlotEntry } from '@/lib/ssr/server-slot-entry';
import { ThemeServerRegistryState } from '@/lib/ssr/theme-server-registry-state';

/**
 * Server-side twin of the registration state that
 * `packages/react/src/context/view/plugins-provider-internal.client.tsx` holds in the browser.
 *
 * A theme or plugin bundle registers itself as a SIDE EFFECT of being imported — the theme entry ends
 * with `ContextBridge.registerTheme(...)`, a plugin's storefront entry registers every component it
 * globbed. In the browser the runtime bridge has already been installed, so those calls land in React
 * state. On the SERVER nothing installs the bridge, so `ContextBridge._args` is null and every
 * `register*` call silently no-ops through optional chaining — the import "succeeds" and captures
 * nothing. This class installs a minimal bridge FIRST, so the same untouched bundles register into
 * server-side maps instead.
 *
 * The bridge is handed in rather than imported: Next bundles `@fromcode119/react` from source while the
 * theme and plugin bundles resolve it through node_modules, so only the copy `ThemeSsrRuntime` loads is
 * the one they will actually call. See the resolution notes on that class.
 *
 * The registrations themselves live in a {@link ThemeServerRegistryState} generation. Readers always see
 * the PUBLISHED one; while a theme/plugin update is being re-imported, the incoming bundles register into
 * a staging generation that is published only once it is complete. That is what keeps a version change
 * from serving half-rendered pages to whatever requests happen to be in flight.
 */
export class ThemeServerRegistry {
  /** What every reader sees. Replaced wholesale by {@link publishGeneration}, never mutated in place. */
  private static published = new ThemeServerRegistryState();

  /** The generation currently being imported, if any. Registrations land here while it exists. */
  private static staging: ThemeServerRegistryState | null = null;

  private static installed = false;

  /** Idempotent: the bridge is a process-wide singleton, so installing twice would drop registrations. */
  static install(contextBridge: { install: (args: unknown) => void }, apiBridge: unknown): void {
    if (ThemeServerRegistry.installed) return;
    ThemeServerRegistry.installed = true;

    const noop = () => undefined;
    contextBridge.install({
      registerTheme: (slug: string, payload: Record<string, unknown>) => {
        ThemeServerRegistry.target().registerTheme(slug, payload);
      },
      registerTranslations: (payload: Record<string, unknown>, layer?: string) => {
        ThemeServerRegistry.target().registerTranslations(payload, layer);
      },
      registerSlotComponent: (name: string, component: unknown, owner?: string, priority?: number) => {
        ThemeServerRegistry.target().addSlot(name, new ServerSlotEntry(component, owner, priority));
      },
      registerOverride: (name: string, component: unknown, owner?: string, priority?: number, loader?: unknown) => {
        ThemeServerRegistry.target().addOverride(name, new ServerSlotEntry(component, owner, priority, loader));
      },
      registerContentTransformer: noop,
      registerFieldComponent: noop,
      registerPluginClient: noop,
      registerMenuItem: noop,
      replaceMenuItems: noop,
      registerCollection: noop,
      replaceCollections: noop,
      registerPlugins: noop,
      registerSettings: noop,
      // Captured, not dropped: a plugin's storefront entry registers its API client here, and theme
      // components resolve it through the namespace facade. The content client is what turns an upload path
      // into an optimizer URL — without it the server renders a `srcset` of full-size originals.
      registerPluginApi: (namespace: string, slug: string, client: unknown) => {
        ThemeServerRegistry.target().registerPluginApi(namespace, slug, client);
      },
      // `ContextBridge.api` proxies onto this; plugin clients read `getBaseUrl()` from it to build
      // absolute URLs. Supplied by `ThemeServerRenderer` before any bundle is imported.
      stableApiBridge: apiBridge,
      emit: noop,
      on: () => noop,
    });
  }

  /**
   * Open an empty generation for the bundles that are about to be imported.
   *
   * Everything the imports register goes here instead of into the live state, so readers keep seeing the
   * previous, complete world for as long as the rebuild takes.
   */
  static beginGeneration(): ThemeServerRegistryState {
    ThemeServerRegistry.staging = new ThemeServerRegistryState();
    return ThemeServerRegistry.staging;
  }

  /** Publish a staged generation. Anything registered after this point lands in the published state. */
  static publishGeneration(state: ThemeServerRegistryState): void {
    ThemeServerRegistry.published = state;
    if (ThemeServerRegistry.staging === state) ThemeServerRegistry.staging = null;
  }

  /**
   * Abandon a staged generation without publishing it — the rebuild failed, so the previously published
   * world stays live rather than the storefront losing its theme over a bad artifact.
   */
  static discardGeneration(state: ThemeServerRegistryState): void {
    if (ThemeServerRegistry.staging === state) ThemeServerRegistry.staging = null;
  }

  /** The `{ layouts, styleVariants, overrides }` a theme registered, or null if it never registered. */
  static payloadFor(slug: string): Record<string, unknown> | null {
    return ThemeServerRegistry.published.payloadFor(slug);
  }

  /** Layout components by name (`DefaultLayout`, …) — the server equivalent of `context.themeLayouts`. */
  static layoutsFor(slug: string): Record<string, unknown> {
    return ThemeServerRegistry.published.layoutsFor(slug);
  }

  /** Style variants the theme registered — `PageStyleProvider` reads them to resolve a page's palette. */
  static styleVariantsFor(slug: string): Record<string, unknown> {
    return ThemeServerRegistry.published.styleVariantsFor(slug);
  }

  /** Slot components by slot name, in the shape `SlotsContext` publishes. */
  static slotMap(): Record<string, unknown[]> {
    return ThemeServerRegistry.published.slotMap();
  }

  /** Overrides by name, in the shape `OverridesContext` publishes. */
  static overrideMap(): Record<string, unknown> {
    return ThemeServerRegistry.published.overrideMap();
  }

  /** Every `registerTranslations` payload captured so far, in registration order. */
  static translationPayloads(): Record<string, unknown>[] {
    return ThemeServerRegistry.published.translationPayloads();
  }

  /** Every `registerTranslations(…, 'theme')` payload — merged after the plugin ones. */
  static themeTranslationPayloads(): Record<string, unknown>[] {
    return ThemeServerRegistry.published.themeTranslationPayloads();
  }

  /** The client a plugin registered, or undefined — the shape `getPluginApi` publishes. */
  static pluginApi(namespace: string, slug: string): unknown {
    return ThemeServerRegistry.published.pluginApi(namespace, slug);
  }

  static hasPluginApi(namespace: string, slug: string): boolean {
    return ThemeServerRegistry.pluginApi(namespace, slug) !== undefined;
  }

  /** Slugs registered so far. Diagnostic — a theme that failed to import simply will not appear. */
  static registeredSlugs(): string[] {
    return ThemeServerRegistry.published.registeredSlugs();
  }

  /** Where an incoming `register*` call belongs: the generation being built, else the live one. */
  private static target(): ThemeServerRegistryState {
    return ThemeServerRegistry.staging ?? ThemeServerRegistry.published;
  }
}
