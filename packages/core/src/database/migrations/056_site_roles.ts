import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { PortableColumnTypes } from '@core/database/helpers/portable-column-types';

/**
 * A site's own roles.
 *
 * `_system_roles` is the PLATFORM's catalog: one table, no owner, no row-level policy. Its editor was
 * reachable by every site's administrator, so one customer could give the shared `customer` role any
 * permission — on every other customer's site too — or delete a role another site's staff sign in with.
 *
 * A site's roles live here instead. The table carries no `tenant_id` of its own on purpose: it is
 * listed in `TenantScopedTables`, and the isolation sweep that runs on every boot adds the column (with
 * the current-tenant default), forces row-level security, applies the policy and rewrites the slug's
 * UNIQUE to `(slug, tenant_id)` — so two sites may each have a `staff` role, and neither can see the
 * other's.
 */
export class SiteRolesMigration extends BaseMigration {
  readonly version = 56;
  readonly name = 'Site roles';

  async up(db: IDatabaseManager): Promise<void> {
    const type = PortableColumnTypes.for(db.dialect);
    await db.execute(sql.raw(
      `CREATE TABLE IF NOT EXISTS _system_site_roles (
        id ${type.autoId},
        slug ${type.key} NOT NULL UNIQUE,
        name ${type.shortText} NOT NULL,
        description ${type.longTextNullable},
        permissions ${type.json} NOT NULL DEFAULT ${type.jsonEmptyArray},
        created_at ${type.timestamp} DEFAULT ${type.now},
        updated_at ${type.timestamp} DEFAULT ${type.now}
      )`,
    ));
  }
}
