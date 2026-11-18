/**
 * Which wrapped handler a given plugin registered for a given event, so a recorded failure can be
 * re-run against the CURRENT listener — the one re-registered on the latest boot, possibly the fixed
 * code. Keyed by (event, plugin): a retry calls exactly that plugin's handler, not every listener of the
 * event, so retrying one does not fire the others again.
 *
 * Process-local and rebuilt on every boot as plugins subscribe, which is what makes a retry safe across
 * a restart: it always finds today's handler, never a stale closure from a dead process.
 */
export class EventListenerRegistry {
  private static readonly byKey = new Map<string, Set<(payload: any, ev: string) => unknown>>();

  private static keyOf(event: string, pluginSlug: string): string {
    return `${event}\u0000${pluginSlug}`;
  }

  static register(event: string, pluginSlug: string, handler: ((payload: any, ev: string) => unknown) | undefined): void {
    if (!handler) return;
    const key = EventListenerRegistry.keyOf(event, pluginSlug);
    const set = EventListenerRegistry.byKey.get(key) ?? new Set();
    set.add(handler);
    EventListenerRegistry.byKey.set(key, set);
  }

  static unregister(event: string, pluginSlug: string, handler: ((payload: any, ev: string) => unknown) | undefined): void {
    if (!handler) return;
    const set = EventListenerRegistry.byKey.get(EventListenerRegistry.keyOf(event, pluginSlug));
    if (!set) return;
    set.delete(handler);
    if (!set.size) EventListenerRegistry.byKey.delete(EventListenerRegistry.keyOf(event, pluginSlug));
  }

  static find(event: string, pluginSlug: string): Array<(payload: any, ev: string) => unknown> {
    return [...(EventListenerRegistry.byKey.get(EventListenerRegistry.keyOf(event, pluginSlug)) ?? [])];
  }
}
