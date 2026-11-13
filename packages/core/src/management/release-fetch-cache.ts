/**
 * Remembers what the release source answered, per address, so an installation asks GitHub a few times
 * an hour instead of on every check.
 *
 * GitHub allows 60 unauthenticated API requests an hour per internet address, shared by every machine
 * behind it. The updater checks every minute; without this the allowance ran out within the hour, every
 * further answer was a 403, and the platform concluded nothing newer existed.
 *
 * What does not change once published (a tag's changelog, a commit, an image that exists) is kept for
 * 15 minutes. What decides how soon a NEW release is seen — the list of tags, an image not published
 * yet — is kept only as long as its caller says (`hitMs` / `missMs`): kept for 15 minutes, a release
 * reached installations 20 minutes after its images. A failure is kept for 5 minutes by default, so an
 * unreachable source is retried without being hammered.
 */
export class ReleaseFetchCache {
  static readonly HIT_MS = 15 * 60 * 1000;
  static readonly MISS_MS = 5 * 60 * 1000;
  /**
   * A refresh asked for by hand drops only answers older than this: a check button pressed ten times
   * in a row costs one request, not ten, and cannot spend the hourly allowance on its own.
   */
  static readonly REFRESH_MIN_AGE_MS = 30 * 1000;
  private static readonly entries = new Map<string, { at: number; value: unknown; volatile: boolean }>();

  /**
   * `load` resolves to `null` for a failed read; that is remembered for the shorter time. An answer
   * remembered for less than the default (`hitMs` or `missMs` given) is one that can go stale, so a
   * refresh asked for by hand drops it.
   */
  static async remember<T>(
    key: string,
    load: () => Promise<T | null>,
    now: () => number = Date.now,
    keep: { hitMs?: number; missMs?: number } = {},
  ): Promise<T | null> {
    const hitMs = keep.hitMs ?? ReleaseFetchCache.HIT_MS;
    const missMs = keep.missMs ?? ReleaseFetchCache.MISS_MS;
    const cached = ReleaseFetchCache.entries.get(key);
    if (cached) {
      const age = now() - cached.at;
      if (age < (cached.value === null ? missMs : hitMs)) return cached.value as T | null;
    }
    const value = await load();
    const volatile = value === null || keep.hitMs !== undefined;
    ReleaseFetchCache.entries.set(key, { at: now(), value, volatile });
    return value;
  }

  /**
   * Forgets every answer that can go stale (a failure, a short-lived answer) once it is older than
   * `REFRESH_MIN_AGE_MS`, so the next read asks again. What cannot change stays remembered.
   */
  static refresh(now: () => number = Date.now): void {
    for (const [key, entry] of ReleaseFetchCache.entries) {
      if (entry.volatile && now() - entry.at >= ReleaseFetchCache.REFRESH_MIN_AGE_MS) ReleaseFetchCache.entries.delete(key);
    }
  }

  static clear(): void {
    ReleaseFetchCache.entries.clear();
  }
}
