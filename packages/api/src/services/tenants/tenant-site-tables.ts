import type { IDatabaseManager } from '@fromcode119/database';
import { TenantColumnPreparer, TenantMode, TenantTableCatalog, TenantTableDescriptor } from '@fromcode119/core';

/** The tables a site's rows live in — for an import, an export, a delete, and an adoption. */
export class TenantSiteTables {
  /**
   * With sites on, those under a site policy. Before the first site there IS no policy — the boot
   * sweep releases them on a deployment with no sites — so it is the tables carrying the site column.
   * Listing by policy there found no table at all, and importing the first site skipped every row.
   */
  static async list(db: IDatabaseManager, systemTables: Set<string>, catalog: TenantTableCatalog): Promise<TenantTableDescriptor[]> {
    if (TenantMode.isEnabled()) return catalog.byPolicy();
    return TenantSiteTables.byColumn(db, systemTables, catalog);
  }

  /**
   * COLUMNS FIRST. On a deployment whose tables predate tenancy none of them has a `tenant_id` — the
   * column only arrives on the boot after a site exists. Adopting before that stamped nothing in those
   * tables and left their rows ownerless, which row-level security then hid from everyone.
   */
  static async byColumn(db: IDatabaseManager, systemTables: Set<string>, catalog: TenantTableCatalog): Promise<TenantTableDescriptor[]> {
    await new TenantColumnPreparer(db).ensureColumns(systemTables);
    return catalog.byColumn();
  }
}
