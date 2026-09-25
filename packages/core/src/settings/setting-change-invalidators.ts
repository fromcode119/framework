import { Logger } from '@core/logging';
import type { ISettingWrite } from '@core/settings/interfaces/setting-write.interface';

/**
 * What a saved system setting must make each in-process cache forget.
 *
 * Several caches hold a value derived from `_system_meta` for the life of the process — a site's
 * mail driver carries its "may send through the platform" decision, a site's locale is read once per
 * site. Each used to subscribe to `system:settings:updated` on its own and work out for itself whose
 * copy the save made stale, and the ones nobody wired kept serving the old value until the api
 * restarted: saved, read back on the screen, and not in force.
 *
 * A cache registers the keys it derives from, once; the settings write reports which row each key
 * landed in. The scope is decided HERE, from the row that was written, not from whichever site the
 * admin had selected: a platform-row write makes every site's copy stale, because every site without
 * its own row reads the value that just changed.
 */
export class SettingChangeInvalidators {
  private static readonly logger = new Logger({ namespace: 'setting-change-invalidators' });

  /** key -> the forgetters that depend on it. */
  private static readonly byKey = new Map<string, Set<(tenantId: string | null) => void>>();

  /**
   * `forget(tenantId)` drops that site's copy; `forget(null)` drops every site's. Returns the
   * unregister function, for a cache whose owner can be torn down.
   */
  static register(keys: readonly string[], forget: (tenantId: string | null) => void): () => void {
    for (const key of keys) {
      const set = SettingChangeInvalidators.byKey.get(key) ?? new Set();
      set.add(forget);
      SettingChangeInvalidators.byKey.set(key, set);
    }
    return () => keys.forEach((key) => SettingChangeInvalidators.byKey.get(key)?.delete(forget));
  }

  /**
   * Called once per settings save with every row it wrote. A forgetter runs at most once per scope,
   * however many of its keys the save touched, and one that throws does not stop the rest — a cache
   * left stale because a neighbour failed is the defect this class exists to close.
   */
  static dispatch(writes: readonly ISettingWrite[]): void {
    const calls = new Map<(tenantId: string | null) => void, Set<string | null>>();
    for (const write of writes) {
      const scope = write.tenantId ? String(write.tenantId) : null;
      for (const forget of SettingChangeInvalidators.byKey.get(write.key) ?? []) {
        const scopes = calls.get(forget) ?? new Set<string | null>();
        scopes.add(scope);
        calls.set(forget, scopes);
      }
    }
    for (const [forget, scopes] of calls) {
      // A platform-wide drop already covers any single site in the same save.
      const targets = scopes.has(null) ? [null] : [...scopes];
      for (const target of targets) {
        try {
          forget(target);
        } catch (error: unknown) {
          SettingChangeInvalidators.logger.error(
            `A cache could not forget a saved setting (${writes.map((w) => w.key).join(', ')}); it serves the `
            + `previous value until it is next refreshed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }
  }

  /** Test seam. */
  static reset(): void {
    SettingChangeInvalidators.byKey.clear();
  }
}
