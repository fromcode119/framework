import { Logger } from '@core/logging';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import { SystemConstants } from '@core/constants/system.constants';
import { RequestContextUtils } from '@core/context/request-context';

export class MetaContextProxy {
  private static readonly logger = new Logger({ namespace: 'plugin-tenancy' });

  /**
   * Creates a read-only meta store proxy for plugins.
   * Plugins should use context.meta.get(key) instead of querying the system meta table directly.
   */
  static createMetaProxy(manager: IPluginManagerInterface) {
    return {
      async get(key: string): Promise<string | null> {
        const row = await manager.db.findOne(SystemConstants.TABLE.META, { key: String(key) });
        return row?.value ?? null;
      },

      /**
       * Upsert a meta value through the framework (plugins must NOT write the `_system_meta` table
       * directly via context.db — that path is blocked). Uses the RAW manager db so the framework owns
       * the only access to the system table. Value is coerced to a string (the column is text).
       */
      async set(key: string, value: unknown): Promise<void> {
        const normalizedKey = String(key);
        const normalizedValue = value == null ? '' : String(value);
        const write = async (): Promise<void> => {
          const existing = await manager.db.findOne(SystemConstants.TABLE.META, { key: normalizedKey });
          if (existing) {
            await manager.db.update(SystemConstants.TABLE.META, { key: normalizedKey }, { value: normalizedValue });
          } else {
            await manager.db.insert(SystemConstants.TABLE.META, { key: normalizedKey, value: normalizedValue });
          }
        };

        // Inside a request there is a tenant and this is one write.
        if (RequestContextUtils.storage.getStore()) return write();

        /**
         * At BOOT there is no tenant, and this used to fan the value out to EVERY tenant.
         *
         * Paired with `get`, which has no tenancy at all, that corrupts data. An unscoped read sees
         * only rows with no owner — the policy's first branch is `tenant_id = current_setting(...)`,
         * which matches nothing when the setting is empty — so the classic `get` → merge → `set`
         * that every seed does reads a blank, merges into a blank, and writes that blank over each
         * site's real value.
         *
         * It happened: Econt credentials transferred into vselenskiportal88 were present, then empty
         * after the next restart, with the row's `updated_at` unchanged so nothing looked like it had
         * written. Any plugin seeding config in `onInit` could blank it for every customer at once.
         *
         * The fan-out is also no longer needed. It predates the per-site replay: the framework now
         * runs `onInit` again once per site with registration suppressed (`PluginSiteDataReplay`), and
         * that pass has both a request store and a bound connection, so this same call lands there as
         * a single correctly scoped write. Skipping here — and saying so — matches what
         * `UntenantedBootAccess` already does for `context.db`, so a plugin author sees one rule.
         */
        MetaContextProxy.logger.warn(
          `skipped context.meta.set("${normalizedKey}") outside a request: this deployment serves `
          + 'several sites and this code path has no site, so the value would be written to all of '
          + 'them from an unscoped read. The framework runs this hook AGAIN, once per site, where the '
          + 'read and the write both see that site — so the work still happens; this pass is the '
          + 'registration one.',
        );
      },

      /**
       * Atomically advance a gap-free numeric counter stored at `key` and return the new value.
       * The counter never drops below `startFloor` (so series can reserve a starting block). Uses
       * optimistic locking on the meta row (the UPDATE matches the current value), so two concurrent
       * callers can never read-modify-write the same number — the loser retries. The framework owns
       * the `_system_meta` write; plugins must not implement this against the raw table.
       */
      async advanceCounter(key: string, startFloor = 0, maxAttempts = 6): Promise<number> {
        const normalizedKey = String(key);
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          const existing = await manager.db.findOne(SystemConstants.TABLE.META, { key: normalizedKey });
          if (!existing) {
            const first = Number(startFloor) + 1;
            await manager.db.insert(SystemConstants.TABLE.META, { key: normalizedKey, value: String(first) });
            return first;
          }
          const parsed = Number(existing.value);
          const current = Math.max(Number(startFloor), Number.isFinite(parsed) ? parsed : Number(startFloor));
          const next = current + 1;
          const updated = await manager.db.update(
            SystemConstants.TABLE.META,
            { key: normalizedKey, value: existing.value },
            { value: String(next) },
          );
          if (updated) return next;
        }
        throw new Error(`Could not advance counter "${normalizedKey}" after ${maxAttempts} attempts`);
      }
    };

  }
}