/**
 * One registered slot component or override, captured server-side.
 *
 * The same record `ContextProviderSlotRegistrationHooks` builds in the browser (`component`,
 * `pluginSlug`, `priority`), plus the raw module `loader` that `ThemeOverrideRegistrar` now passes
 * alongside a lazily-registered override. The loader is what lets the server turn a `React.lazy`
 * registration into a real component before rendering — `renderToStaticMarkup` renders the Suspense
 * fallback, never the lazy child.
 */
export class ServerSlotEntry {
  readonly component: unknown;

  readonly pluginSlug: string;

  readonly priority: number;

  private readonly loader: unknown;

  constructor(component: unknown, pluginSlug?: string, priority?: number, loader?: unknown) {
    this.component = component;
    this.pluginSlug = String(pluginSlug || 'unknown');
    this.priority = Number(priority) || 0;
    this.loader = loader;
  }

  /**
   * A registration comes from a theme or plugin bundle at runtime, so it is UNTRUSTED input rather than
   * a framework contract — a bad build can register anything. Mirrors `Slot.isValidComponent`.
   */
  get isRenderable(): boolean {
    return typeof this.component === 'function'
      || typeof this.component === 'string'
      || Boolean((this.component as { $$typeof?: unknown } | null)?.$$typeof);
  }

  /** The record shape `SlotsContext` / `OverridesContext` publish. */
  toSlotComponent(): Record<string, unknown> {
    return { component: this.component, pluginSlug: this.pluginSlug, priority: this.priority };
  }

  /**
   * This entry with its lazy component replaced by the loaded one. Returns `this` when there is no
   * loader, or when loading fails — a renderer that cannot be loaded server-side degrades to the
   * client render of that one block rather than failing the page.
   */
  async resolve(): Promise<ServerSlotEntry> {
    if (!this.loader) return this;
    try {
      const loaded = await (this.loader as () => Promise<{ default?: unknown }>)();
      const component = loaded?.default;
      if (!component) return this;
      return new ServerSlotEntry(component, this.pluginSlug, this.priority);
    } catch {
      return this;
    }
  }
}
