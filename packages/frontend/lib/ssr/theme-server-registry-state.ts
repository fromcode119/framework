import { FrontendI18nService } from '@fromcode119/react/context/frontend-i18n-service';
import { ServerSlotEntry } from '@/lib/ssr/server-slot-entry';

/**
 * One generation of server-side registrations — everything a set of theme/plugin SSR bundles registered
 * when they were imported.
 *
 * It is a separate object from {@link ThemeServerRegistry} so a theme or plugin update can build a
 * COMPLETE replacement in the background and be swapped in atomically. The alternative — clearing the
 * maps in place and re-importing — leaves every request that lands mid-rebuild rendering against a
 * half-registered world: a page with no footer, or no block flow at all. Empty pages are exactly the
 * failure this whole version-aware path exists to end, so a generation is never published half-built.
 *
 * The reducers mirror `ContextProviderSlotRegistrationHooks` in the browser exactly — slots are an array
 * sorted by ascending priority, an override is a single entry where the highest priority wins. A
 * divergence here shows up as markup that changes when the browser bundles take over.
 */
export class ThemeServerRegistryState {
  private readonly themes = new Map<string, Record<string, unknown>>();

  private readonly translations: Record<string, unknown>[] = [];

  /** The THEME's copy, kept apart from the plugin payloads above so it can be merged as a later layer. */
  private readonly themeTranslations: Record<string, unknown>[] = [];

  private readonly slots = new Map<string, ServerSlotEntry[]>();

  private readonly overrides = new Map<string, ServerSlotEntry>();

  /** Plugin API clients, keyed `namespace:slug` — what `ContextHooks.usePluginsNamespace` resolves. */
  private readonly pluginApis = new Map<string, unknown>();

  private warmed = false;

  registerTheme(slug: string, payload: Record<string, unknown>): void {
    const themeSlug = String(slug || '');
    this.themes.set(themeSlug, payload || {});
    // A theme declares its slot overrides as a map on this payload (`ThemeConfig.overrides`), and the
    // BROWSER's registerTheme expands that map into registerOverride calls. Storing the payload alone
    // meant none of them existed server-side: every `<Override>` fell back to the framework default in
    // the SSR html and only became the theme's after the browser booted — a guaranteed swap on first
    // paint for the 404 page, the account skeleton and anything else registered this way.
    this.registerThemeOverrides(themeSlug, (payload || {}).overrides);
  }

  /**
   * `layer` routes the payload to the same bucket the browser provider would pick. Dropping it here —
   * folding a theme's copy in with the plugin payloads — would make the server resolve a collision the
   * opposite way from the client, which reads as text changing between the server paint and hydration.
   */
  registerTranslations(payload: Record<string, unknown>, layer?: string): void {
    if (!payload) return;
    const bucket = layer === FrontendI18nService.THEME_LAYER ? this.themeTranslations : this.translations;
    bucket.push(payload);
  }

  registerPluginApi(namespace: string, slug: string, client: unknown): void {
    this.pluginApis.set(ThemeServerRegistryState.pluginApiKey(namespace, slug), client);
  }

  addSlot(name: string, entry: ServerSlotEntry): void {
    if (!entry.isRenderable) return;
    const key = String(name || '');
    const existing = this.slots.get(key) ?? [];
    if (existing.some((item) => item.component === entry.component)) return;
    this.slots.set(key, [...existing, entry].sort((a, b) => a.priority - b.priority));
  }

  addOverride(name: string, entry: ServerSlotEntry): void {
    if (!entry.isRenderable) return;
    const key = String(name || '');
    const existing = this.overrides.get(key);
    if (existing && existing.priority >= entry.priority) return;
    this.overrides.set(key, entry);
  }

  /**
   * Replace every lazily-registered override with its resolved component, re-wrapped by `wrap`.
   *
   * `ThemeOverrideRegistrar` registers block renderers as `React.lazy` wrapped in a Suspense boundary,
   * which a synchronous server render emits as the FALLBACK — for the home page that means the hero, the
   * LCP element, never appears. Awaiting the raw loaders once per generation (they are the theme's own
   * renderer modules) is what makes the block flow render for real. `wrap` puts the resolved component
   * back inside exactly the boundary the browser registration has (`ThemeSsrRuntime.wrapOverride`), so
   * the server's `<!--$-->` markers sit where the client tree's Suspense is and hydration adopts the
   * block in place. A loader that fails leaves its lazy entry in place, so that one block degrades to the
   * client render instead of taking the page down.
   */
  async warmOverrides(wrap: (component: unknown) => unknown): Promise<void> {
    if (this.warmed) return;
    this.warmed = true;

    await Promise.all(
      [...this.overrides.entries()].map(async ([name, entry]) => {
        const resolved = await entry.resolve(wrap);
        if (resolved !== entry) this.overrides.set(name, resolved);
      }),
    );
  }

  /** The `{ layouts, styleVariants, overrides }` a theme registered, or null if it never registered. */
  payloadFor(slug: string): Record<string, unknown> | null {
    return this.themes.get(String(slug || '')) ?? null;
  }

  /** Layout components by name (`DefaultLayout`, …) — the server equivalent of `context.themeLayouts`. */
  layoutsFor(slug: string): Record<string, unknown> {
    return (this.payloadFor(slug)?.layouts as Record<string, unknown>) ?? {};
  }

  /** Style variants the theme registered — `PageStyleProvider` reads them to resolve a page's palette. */
  styleVariantsFor(slug: string): Record<string, unknown> {
    return (this.payloadFor(slug)?.styleVariants as Record<string, unknown>) ?? {};
  }

  /** Slot components by slot name, in the shape `SlotsContext` publishes. */
  slotMap(): Record<string, unknown[]> {
    const map: Record<string, unknown[]> = {};
    for (const [name, entries] of this.slots) map[name] = entries.map((entry) => entry.toSlotComponent());
    return map;
  }

  /** Overrides by name, in the shape `OverridesContext` publishes. */
  overrideMap(): Record<string, unknown> {
    const map: Record<string, unknown> = {};
    for (const [name, entry] of this.overrides) map[name] = entry.toSlotComponent();
    return map;
  }

  /** Every `registerTranslations` payload captured so far, in registration order. */
  translationPayloads(): Record<string, unknown>[] {
    return [...this.translations];
  }

  /** Every `registerTranslations(…, 'theme')` payload — merged after the plugin ones. */
  themeTranslationPayloads(): Record<string, unknown>[] {
    return [...this.themeTranslations];
  }

  /** The client a plugin registered, or undefined — the shape `getPluginApi` publishes. */
  pluginApi(namespace: string, slug: string): unknown {
    return this.pluginApis.get(ThemeServerRegistryState.pluginApiKey(namespace, slug));
  }

  /** Slugs registered so far. Diagnostic — a theme that failed to import simply will not appear. */
  registeredSlugs(): string[] {
    return [...this.themes.keys()];
  }

  /** The same expansion the browser does: `{ 'slot.name': Component }` (or an array) → registered overrides. */
  private registerThemeOverrides(slug: string, overrides: unknown): void {
    if (!overrides) return;
    if (Array.isArray(overrides)) {
      for (const entry of overrides as Array<{ name?: string; component?: unknown; priority?: number }>) {
        if (entry?.name && entry?.component) {
          this.addOverride(entry.name, new ServerSlotEntry(entry.component, slug, entry.priority ?? 10));
        }
      }
      return;
    }
    for (const [name, component] of Object.entries(overrides as Record<string, unknown>)) {
      if (name && component) this.addOverride(name, new ServerSlotEntry(component, slug, 10));
    }
  }

  private static pluginApiKey(namespace: string, slug: string): string {
    return `${String(namespace || '')}:${String(slug || '')}`;
  }
}
