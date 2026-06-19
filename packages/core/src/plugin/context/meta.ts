import type { PluginManagerInterface } from './utils.interfaces';
import { SystemConstants } from '../../constants';

export class MetaContextProxy {
  /**
   * Creates a read-only meta store proxy for plugins.
   * Plugins should use context.meta.get(key) instead of querying the system meta table directly.
   */
  static createMetaProxy(manager: PluginManagerInterface) {
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
        const existing = await manager.db.findOne(SystemConstants.TABLE.META, { key: normalizedKey });
        if (existing) {
          await manager.db.update(SystemConstants.TABLE.META, { key: normalizedKey }, { value: normalizedValue });
        } else {
          await manager.db.insert(SystemConstants.TABLE.META, { key: normalizedKey, value: normalizedValue });
        }
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