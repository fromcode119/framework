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
 * The registrations themselves live in {@link ThemeServerRegistryState} generations, ONE PER SIGNATURE
 * (theme@version + the plugin versions a site runs — see `ThemeSsrGeneration`). On a multi-tenant
 * deployment two sites on different themes render in the same process at the same time, so there is
 * no single "published" world any more: every reader names the generation it is rendering, and a
 * reader that names one this process has not built gets an EMPTY state — never another site's theme.
 * Two sites on the same theme and plugin set share one generation, so memory is bounded by distinct
 * signatures, not by tenants.
 *
 * While a generation is being imported, the incoming bundles register into a single STAGING state
 * (the bridge is a process-wide singleton, so builds are serialized by the renderer) that is published
 * under its signature only once complete. That is what keeps a rebuild from serving half-rendered pages
 * to whatever requests happen to be in flight.
 */
export class ThemeServerRegistry {
  /** Published worlds by signature. Replaced per key by {@link publishGeneration}, never mutated in place. */
  private static published = new Map<string, ThemeServerRegistryState>();

  /** The empty answer for a signature nobody built. Shared and never registered into. */
  private static readonly EMPTY = new ThemeServerRegistryState();

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

  /** Publish a staged generation under its signature. */
  static publishGeneration(signature: string, state: ThemeServerRegistryState): void {
    ThemeServerRegistry.published.set(signature, state);
    if (ThemeServerRegistry.staging === state) ThemeServerRegistry.staging = null;
  }

  /** Drop a published generation (the renderer evicts least-recently-used ones above its cap). */
  static evict(signature: string): void {
    ThemeServerRegistry.published.delete(signature);
  }

  static hasGeneration(signature: string): boolean {
    return ThemeServerRegistry.published.has(signature);
  }

  /** The published state for a signature, or the shared EMPTY one — never a different generation's. */
  private static world(signature: string): ThemeServerRegistryState {
    return ThemeServerRegistry.published.get(signature) ?? ThemeServerRegistry.EMPTY;
  }

  /**
   * Abandon a staged generation without publishing it — the rebuild failed, so the previously published
   * world stays live rather than the storefront losing its theme over a bad artifact.
   */
  static discardGeneration(state: ThemeServerRegistryState): void {
    if (ThemeServerRegistry.staging === state) ThemeServerRegistry.staging = null;
  }

  /** The `{ layouts, styleVariants, overrides }` a theme registered, or null if it never registered. */
  static payloadFor(signature: string, slug: string): Record<string, unknown> | null {
    return ThemeServerRegistry.world(signature).payloadFor(slug);
  }

  /** Layout components by name (`DefaultLayout`, …) — the server equivalent of `context.themeLayouts`. */
  static layoutsFor(signature: string, slug: string): Record<string, unknown> {
    return ThemeServerRegistry.world(signature).layoutsFor(slug);
  }

  /** Style variants the theme registered — `PageStyleProvider` reads them to resolve a page's palette. */
  static styleVariantsFor(signature: string, slug: string): Record<string, unknown> {
    return ThemeServerRegistry.world(signature).styleVariantsFor(slug);
  }

  /** Slot components by slot name, in the shape `SlotsContext` publishes. */
  static slotMap(signature: string): Record<string, unknown[]> {
    return ThemeServerRegistry.world(signature).slotMap();
  }

  /** Overrides by name, in the shape `OverridesContext` publishes. */
  static overrideMap(signature: string): Record<string, unknown> {
    return ThemeServerRegistry.world(signature).overrideMap();
  }

  /** Every `registerTranslations` payload captured so far, in registration order. */
  static translationPayloads(signature: string): Record<string, unknown>[] {
    return ThemeServerRegistry.world(signature).translationPayloads();
  }

  /** Every `registerTranslations(…, 'theme')` payload — merged after the plugin ones. */
  static themeTranslationPayloads(signature: string): Record<string, unknown>[] {
    return ThemeServerRegistry.world(signature).themeTranslationPayloads();
  }

  /** The client a plugin registered, or undefined — the shape `getPluginApi` publishes. */
  static pluginApi(signature: string, namespace: string, slug: string): unknown {
    return ThemeServerRegistry.world(signature).pluginApi(namespace, slug);
  }

  static hasPluginApi(signature: string, namespace: string, slug: string): boolean {
    return ThemeServerRegistry.pluginApi(signature, namespace, slug) !== undefined;
  }

  /** Slugs registered in a generation. Diagnostic — a theme that failed to import simply will not appear. */
  static registeredSlugs(signature: string): string[] {
    return ThemeServerRegistry.world(signature).registeredSlugs();
  }

  /** Signatures currently resident — what the LRU cap is measured against. */
  static publishedSignatures(): string[] {
    return [...ThemeServerRegistry.published.keys()];
  }

  /**
   * Where an incoming `register*` call belongs: the generation being built. A registration that arrives
   * with NO build in progress has no home — bundles register as a side effect of import, and every
   * import happens inside a build — so it is dropped into a throwaway state and said out loud, rather
   * than mutating some published world behind a live render.
   */
  private static target(): ThemeServerRegistryState {
    if (ThemeServerRegistry.staging) return ThemeServerRegistry.staging;
    console.warn('[frontend] SSR registration arrived outside a generation build and was ignored.');
    return new ThemeServerRegistryState();
  }
}
