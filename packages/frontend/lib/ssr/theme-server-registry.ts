import { ServerSlotEntry } from '@/lib/ssr/server-slot-entry';

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
 * The reducers below mirror `ContextProviderSlotRegistrationHooks` exactly — slots are an array sorted
 * by ascending priority, an override is a single entry where the highest priority wins. A divergence
 * here shows up as markup that changes when the browser bundles take over.
 */
export class ThemeServerRegistry {
  private static readonly themes = new Map<string, Record<string, unknown>>();

  private static readonly translations: Record<string, unknown>[] = [];

  private static readonly slots = new Map<string, ServerSlotEntry[]>();

  private static readonly overrides = new Map<string, ServerSlotEntry>();

  /** Plugin API clients, keyed `namespace:slug` — what `ContextHooks.usePluginsNamespace` resolves. */
  private static readonly pluginApis = new Map<string, unknown>();

  private static installed = false;

  private static warmed = false;

  /** Idempotent: the bridge is a process-wide singleton, so installing twice would drop registrations. */
  static install(contextBridge: { install: (args: unknown) => void }, apiBridge: unknown): void {
    if (ThemeServerRegistry.installed) return;
    ThemeServerRegistry.installed = true;

    const noop = () => undefined;
    contextBridge.install({
      registerTheme: (slug: string, payload: Record<string, unknown>) => {
        const themeSlug = String(slug || '');
        ThemeServerRegistry.themes.set(themeSlug, payload || {});
        // A theme declares its slot overrides as a map on this payload (`ThemeConfig.overrides`), and the
        // BROWSER's registerTheme expands that map into registerOverride calls. Storing the payload alone
        // meant none of them existed server-side: every `<Override>` fell back to the framework default in
        // the SSR html and only became the theme's after the browser booted — a guaranteed swap on first
        // paint for the 404 page, the account skeleton and anything else registered this way.
        ThemeServerRegistry.registerThemeOverrides(themeSlug, (payload || {}).overrides);
      },
      registerTranslations: (payload: Record<string, unknown>) => {
        if (payload) ThemeServerRegistry.translations.push(payload);
      },
      registerSlotComponent: (name: string, component: unknown, owner?: string, priority?: number) => {
        ThemeServerRegistry.addSlot(name, new ServerSlotEntry(component, owner, priority));
      },
      registerOverride: (name: string, component: unknown, owner?: string, priority?: number, loader?: unknown) => {
        ThemeServerRegistry.addOverride(name, new ServerSlotEntry(component, owner, priority, loader));
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
      // components resolve it through the namespace facade. The cms client is what turns an upload path
      // into an optimizer URL — without it the server renders a `srcset` of full-size originals.
      registerPluginApi: (namespace: string, slug: string, client: unknown) => {
        ThemeServerRegistry.pluginApis.set(ThemeServerRegistry.pluginApiKey(namespace, slug), client);
      },
      // `ContextBridge.api` proxies onto this; plugin clients read `getBaseUrl()` from it to build
      // absolute URLs. Supplied by `ThemeServerRenderer` before any bundle is imported.
      stableApiBridge: apiBridge,
      emit: noop,
      on: () => noop,
    });
  }

  /** The same expansion the browser does: `{ 'slot.name': Component }` (or an array) → registered overrides. */
  private static registerThemeOverrides(slug: string, overrides: unknown): void {
    if (!overrides) return;
    if (Array.isArray(overrides)) {
      for (const entry of overrides as Array<{ name?: string; component?: unknown; priority?: number }>) {
        if (entry?.name && entry?.component) {
          ThemeServerRegistry.addOverride(entry.name, new ServerSlotEntry(entry.component, slug, entry.priority ?? 10));
        }
      }
      return;
    }
    for (const [name, component] of Object.entries(overrides as Record<string, unknown>)) {
      if (name && component) ThemeServerRegistry.addOverride(name, new ServerSlotEntry(component, slug, 10));
    }
  }

  private static pluginApiKey(namespace: string, slug: string): string {
    return `${String(namespace || '')}:${String(slug || '')}`;
  }

  /** The client a plugin registered, or undefined — the shape `getPluginApi` publishes. */
  static pluginApi(namespace: string, slug: string): unknown {
    return ThemeServerRegistry.pluginApis.get(ThemeServerRegistry.pluginApiKey(namespace, slug));
  }

  static hasPluginApi(namespace: string, slug: string): boolean {
    return ThemeServerRegistry.pluginApi(namespace, slug) !== undefined;
  }

  private static addSlot(name: string, entry: ServerSlotEntry): void {
    if (!entry.isRenderable) return;
    const key = String(name || '');
    const existing = ThemeServerRegistry.slots.get(key) ?? [];
    if (existing.some((item) => item.component === entry.component)) return;
    ThemeServerRegistry.slots.set(key, [...existing, entry].sort((a, b) => a.priority - b.priority));
  }

  private static addOverride(name: string, entry: ServerSlotEntry): void {
    if (!entry.isRenderable) return;
    const key = String(name || '');
    const existing = ThemeServerRegistry.overrides.get(key);
    if (existing && existing.priority >= entry.priority) return;
    ThemeServerRegistry.overrides.set(key, entry);
  }

  /**
   * Replace every lazily-registered override with its resolved component.
   *
   * `ThemeOverrideRegistrar` registers block renderers as `React.lazy` wrapped in a Suspense boundary,
   * which `renderToStaticMarkup` renders as the FALLBACK — for the home page that means the hero, the
   * LCP element, never appears. Awaiting the raw loaders once per process (they are the theme's own
   * renderer modules) is what makes the block flow render for real. A loader that fails leaves its lazy
   * entry in place, so that one block degrades to the client render instead of taking the page down.
   */
  static async warmOverrides(): Promise<void> {
    if (ThemeServerRegistry.warmed) return;
    ThemeServerRegistry.warmed = true;

    await Promise.all(
      [...ThemeServerRegistry.overrides.entries()].map(async ([name, entry]) => {
        const resolved = await entry.resolve();
        if (resolved !== entry) ThemeServerRegistry.overrides.set(name, resolved);
      }),
    );
  }

  /** The `{ layouts, styleVariants, overrides }` a theme registered, or null if it never registered. */
  static payloadFor(slug: string): Record<string, unknown> | null {
    return ThemeServerRegistry.themes.get(String(slug || '')) ?? null;
  }

  /** Layout components by name (`DefaultLayout`, …) — the server equivalent of `context.themeLayouts`. */
  static layoutsFor(slug: string): Record<string, unknown> {
    const payload = ThemeServerRegistry.payloadFor(slug);
    return (payload?.layouts as Record<string, unknown>) ?? {};
  }

  /** Style variants the theme registered — `PageStyleProvider` reads them to resolve a page's palette. */
  static styleVariantsFor(slug: string): Record<string, unknown> {
    const payload = ThemeServerRegistry.payloadFor(slug);
    return (payload?.styleVariants as Record<string, unknown>) ?? {};
  }

  /** Slot components by slot name, in the shape `SlotsContext` publishes. */
  static slotMap(): Record<string, unknown[]> {
    const map: Record<string, unknown[]> = {};
    for (const [name, entries] of ThemeServerRegistry.slots) map[name] = entries.map((entry) => entry.toSlotComponent());
    return map;
  }

  /** Overrides by name, in the shape `OverridesContext` publishes. */
  static overrideMap(): Record<string, unknown> {
    const map: Record<string, unknown> = {};
    for (const [name, entry] of ThemeServerRegistry.overrides) map[name] = entry.toSlotComponent();
    return map;
  }

  /** Every `registerTranslations` payload captured so far, in registration order. */
  static translationPayloads(): Record<string, unknown>[] {
    return [...ThemeServerRegistry.translations];
  }

  /** Slugs registered so far. Diagnostic — a theme that failed to import simply will not appear. */
  static registeredSlugs(): string[] {
    return [...ThemeServerRegistry.themes.keys()];
  }
}
