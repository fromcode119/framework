import type { IDatabaseManager } from '@core/interfaces/database-manager.interface';

/**
 * A plugin's `context.db`: the database manager surface, plus `stored`.
 *
 * `stored` is the SAME view (same table guards, rate limit and camelCase denormalization) minus the
 * localized-field collapse, so `localized: true` columns come back in their STORED shape — the full
 * per-locale map. Read-modify-write of a localized field MUST go through `stored`: reading the
 * collapsed view and writing it back replaces the whole locale map with one locale's value.
 */
export interface IPluginContextDb extends IDatabaseManager {
  readonly stored: IDatabaseManager;
  /**
   * The same view, but `find`/`count`/`groupCount`/`aggregate` on an ARCHIVABLE collection also return archived
   * rows, which the default view leaves out. For code that must see every row: a sequence finding the
   * highest number already issued, an existence check that must not hand out a taken value.
   */
  readonly withArchived: IPluginContextDb;
}
