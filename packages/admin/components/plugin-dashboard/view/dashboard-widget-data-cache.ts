/**
 * One load shared by every dashboard widget that asks for the same `key`, kept briefly.
 *
 * A plugin offering six widgets over the same figures would otherwise make six identical sets of
 * requests on every dashboard visit. The first widget to ask starts the load and the rest share it; a
 * failed load is dropped at once, so the next visit tries again instead of repeating the error.
 */
export class DashboardWidgetDataCache {
  private static readonly entries = new Map<string, { at: number; value: Promise<unknown> }>();

  static load<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const hit = DashboardWidgetDataCache.entries.get(key);
    if (hit && Date.now() - hit.at < ttlMs) return hit.value as Promise<T>;
    const value = loader().catch((error) => {
      DashboardWidgetDataCache.entries.delete(key);
      throw error;
    });
    DashboardWidgetDataCache.entries.set(key, { at: Date.now(), value });
    return value;
  }
}
