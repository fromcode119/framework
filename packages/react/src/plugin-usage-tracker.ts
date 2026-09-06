/**
 * Which plugins' components a render actually mounted. `Slot` and `Override` report the owning plugin
 * of every component they render (before the component decides what to output, so a component that
 * renders nothing still counts). The server reads the set after `renderToString` — synchronous, so one
 * render owns the set — and the document tells the runtime which idle plugin bundles a page never
 * needs. In the browser the record is a cheap no-op set nobody reads.
 */
export class PluginUsageTracker {
  private static used = new Set<string>();

  static record(pluginSlug: unknown): void {
    const slug = String(pluginSlug || '').trim();
    if (slug) PluginUsageTracker.used.add(slug);
  }

  static reset(): void {
    PluginUsageTracker.used = new Set<string>();
  }

  /** The slugs recorded since the last reset, sorted for stable output. */
  static drain(): string[] {
    const slugs = [...PluginUsageTracker.used].sort();
    PluginUsageTracker.reset();
    return slugs;
  }
}
