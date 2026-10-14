/**
 * Remembers what the release source answered, per address, so an installation asks GitHub a few times
 * an hour instead of on every check.
 *
 * GitHub allows 60 unauthenticated API requests an hour per internet address, shared by every machine
 * behind it. The updater checks every minute; without this the allowance ran out within the hour, every
 * further answer was a 403, and the platform concluded nothing newer existed. An answer is kept for 15
 * minutes; a failure for 5, so an unreachable source is retried without being hammered.
 */
export class ReleaseFetchCache {
  static readonly HIT_MS = 15 * 60 * 1000;
  static readonly MISS_MS = 5 * 60 * 1000;
  private static readonly entries = new Map<string, { at: number; value: unknown }>();

  /** `load` resolves to `null` for a failed read; that is remembered for the shorter time. */
  static async remember<T>(key: string, load: () => Promise<T | null>, now: () => number = Date.now): Promise<T | null> {
    const cached = ReleaseFetchCache.entries.get(key);
    if (cached) {
      const age = now() - cached.at;
      if (age < (cached.value === null ? ReleaseFetchCache.MISS_MS : ReleaseFetchCache.HIT_MS)) return cached.value as T | null;
    }
    const value = await load();
    ReleaseFetchCache.entries.set(key, { at: now(), value });
    return value;
  }

  static clear(): void {
    ReleaseFetchCache.entries.clear();
  }
}
