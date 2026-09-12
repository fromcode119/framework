import { TenantRlsSql, sql } from '@fromcode119/database';
import { Logger } from '@core/logging';
import { TenantScopedTableDdl } from '@core/database/tenant-scoped-table-ddl';

/**
 * Gives every tenant-scoped table its `tenant_id` column, BEFORE a deployment is adopted.
 *
 * Adoption stamps each row with the new tenant's id, and it can only stamp a table that has the
 * column. On a deployment whose tables predate tenancy none of them do: `applyTenantIsolation`
 * returns early while tenant mode is off, so the column arrives on the NEXT boot — after adoption
 * has already run and finished. The rows it could not stamp then keep a NULL owner, which
 * row-level security reads as belonging to nobody, and the boot sweep says so and moves on.
 *
 * Measured on a real adoption before this existed: 20 rows across 8 tables — a site's pages, its
 * form, its shipping zones and methods, its MLM programs and tiers — all invisible to every tenant
 * the moment isolation came on, while the deployment reported a successful adoption.
 *
 * Only the COLUMN and its index, never the policy. A column that is nullable and defaults to NULL
 * outside a tenant changes nothing on a deployment that has no tenants yet; enabling row-level
 * security there would hide every row, which is the documented reason the sweep refuses to.
 */
export class TenantColumnPreparer {
  private readonly logger = new Logger({ namespace: 'tenant-adoption' });

  constructor(private readonly db: any) {}

  /**
   * Adds the column to every scoped table that lacks it, and answers how many were changed.
   *
   * `system` is the set of table names the caller knows to be framework collections marked
   * `system: true` — the same signal `TenantScopedTableDdl` uses to leave platform configuration
   * alone. A table it refuses to scope is left untouched here too, so the two cannot disagree.
   */
  async ensureColumns(systemTables: Set<string> = new Set()): Promise<number> {
    const tables: string[] = await this.db.getTables();
    let prepared = 0;

    for (const table of tables ?? []) {
      const name = String(table ?? '');
      if (!TenantScopedTableDdl.isTenantScoped(name, { system: systemTables.has(name.toLowerCase()) })) continue;

      for (const statement of TenantRlsSql.columnStatementsFor(name)) {
        await this.db.execute(sql.raw(statement));
      }
      prepared += 1;
    }

    this.logger.debug(`Prepared ${prepared} table(s) with a tenant column before adoption.`);
    return prepared;
  }
}
