import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '@core/database/helpers/dialect';

/**
 * Fixes two defects in T1's per-tenant settings, both found by probing the running database rather
 * than by reading the code. T1 proved a tenant could not READ another tenant's setting; it never
 * proved a tenant could WRITE its own.
 *
 * DEFECT 1 — `_system_meta`'s primary key is `key` alone, so two tenants can never hold the same
 * setting. The second one to set `site_name` gets
 * `duplicate key value violates unique constraint "_system_meta_pkey"`. Per-tenant settings were
 * structurally impossible; the isolation the T1 suite measured was the isolation of an empty set.
 *
 * DEFECT 2 — precedence was undefined. The T1 policy lets a tenant read platform rows
 * (`tenant_id IS NULL`) as well as its own, and every caller reads with
 * `findOne(META, { key })` → `... WHERE key = $1 LIMIT 1` with no ORDER BY. With a tenant row AND a
 * platform row for one key, which value the site used was down to the planner.
 *
 * The fix for defect 2 is to make the two sets DISJOINT in the database instead of resolving a
 * precedence rule at twenty call sites: a platform row is visible only for the small, fixed list of
 * deployment truths a tenant cannot own, and every other key becomes per-tenant. One key therefore
 * never has two visible rows, and `findOne` is unambiguous again.
 */
export class SettingsIdentityMigration extends BaseMigration {
  readonly version = 23;
  readonly name = 'Per-tenant settings identity: composite key and disjoint platform keys';

  /**
   * Deployment truths a tenant cannot own — the ONLY keys a tenant may read from the platform row.
   *
   * Deliberately the same list as migration 022, and deliberately in the policy rather than in
   * application code: which settings cross the tenant boundary is a security boundary, so it is
   * enforced by the database and changing it takes a migration.
   */
  private static readonly PLATFORM_KEYS = [
    'marketplace_url', 'admin_url', 'frontend_url', 'site_url',
    'maintenance_mode', 'setup_completed',
    'ssr_generation_cap',
    'plugin_isolation_default', 'plugin_isolation_memory_mb', 'plugin_isolation_timeout_ms',
    'ssr_render_memory_mb', 'ssr_render_timeout_ms',
  ];

  async up(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await SettingsIdentityMigration.widenPrimaryKey(db);
        await SettingsIdentityMigration.giveEachTenantItsOwnRows(db);
        await SettingsIdentityMigration.narrowPlatformReads(db);
      },
      sqlite: async () => {
        // SQLite isolation is file-per-tenant (S1), so one file holds one tenant's settings and the
        // key alone is already unique within it. Rebuilding the table to widen a primary key that
        // cannot collide would be risk with no benefit.
      },
    });
  }

  /**
   * `NULLS NOT DISTINCT` is what makes this work: without it Postgres treats every NULL as unique,
   * so the platform row would stop being unique per key and duplicates could accumulate silently.
   * It needs Postgres 15+, which this deployment is.
   */
  private static async widenPrimaryKey(db: IDatabaseManager): Promise<void> {
    await db.execute(sql.raw('ALTER TABLE "_system_meta" DROP CONSTRAINT IF EXISTS "_system_meta_pkey"'));
    await db.execute(sql.raw(
      'ALTER TABLE "_system_meta" ADD CONSTRAINT "_system_meta_pkey" '
      + 'UNIQUE NULLS NOT DISTINCT ("key", "tenant_id")',
    ));
  }

  /**
   * Every existing tenant inherits the configuration that was in force, so nothing changes for
   * anyone on the day this runs.
   *
   * The platform rows are NOT deleted. On a single-tenant deployment there are no tenants to copy
   * to, and deleting would erase every setting on the platform; they also stay as the value a tenant
   * created later starts from, which is a reader, not dead weight.
   */
  private static async giveEachTenantItsOwnRows(db: IDatabaseManager): Promise<void> {
    const keys = SettingsIdentityMigration.PLATFORM_KEYS.map((key) => `'${key}'`).join(', ');

    // FORCE ROW LEVEL SECURITY applies to the table OWNER too — that is the whole reason it exists
    // (without it the owner reads every tenant's rows while everything looks healthy). But it also
    // means this migration, running as the owner with no tenant bound, cannot write the per-tenant
    // rows it exists to write: `WITH CHECK` rejects every one of them with
    // `new row violates row-level security policy`. Lifting FORCE for the copy and restoring it
    // immediately afterwards is the narrow, explicit way through; the alternative — a policy loose
    // enough for the migration to slip past — would be loose for every request as well.
    await db.execute(sql.raw('ALTER TABLE "_system_meta" NO FORCE ROW LEVEL SECURITY'));
    await db.execute(sql.raw(`
      INSERT INTO "_system_meta" ("key", "value", "description", "group", "tenant_id")
      SELECT m."key", m."value", m."description", m."group", t."id"
      FROM "_system_meta" m
      CROSS JOIN "_system_tenants" t
      WHERE m."tenant_id" IS NULL AND m."key" NOT IN (${keys})
      ON CONFLICT DO NOTHING
    `));
    await db.execute(sql.raw('ALTER TABLE "_system_meta" FORCE ROW LEVEL SECURITY'));
  }

  /**
   * A tenant sees the platform row ONLY for the deployment truths above. Every other key resolves to
   * exactly one visible row — its own — so there is no precedence question left to get wrong.
   *
   * THE SECOND BRANCH IS NOT OPTIONAL. When no tenant is bound to the connection there is no
   * single-tenant deployment to speak of — there is just a deployment, and ALL of its settings are
   * the platform rows. Narrowing unconditionally would have hidden 54 of the 60 rows from every
   * installation that has no tenants, which is every existing installation. That is precisely the
   * failure T0 §8.1 already had to correct once: a tenancy rule written as if tenants always exist.
   *
   * WITH CHECK is unchanged from 022: a tenant writes its own rows, and a platform row is writable
   * only while the connection carries the verified platform-admin marker.
   */
  private static async narrowPlatformReads(db: IDatabaseManager): Promise<void> {
    const keys = SettingsIdentityMigration.PLATFORM_KEYS.map((key) => `'${key}'`).join(', ');
    const current = `nullif(current_setting('app.tenant_id', true), '')`;
    const own = `"tenant_id" = ${current}`;

    // Re-asserted rather than assumed: 022 set them, but this migration lifted FORCE for the copy
    // above and a table left un-FORCEd would let the owner connection read every tenant.
    await db.execute(sql.raw('ALTER TABLE "_system_meta" ENABLE ROW LEVEL SECURITY'));
    await db.execute(sql.raw('ALTER TABLE "_system_meta" FORCE ROW LEVEL SECURITY'));
    await db.execute(sql.raw('DROP POLICY IF EXISTS "_system_meta_tenant_isolation" ON "_system_meta"'));
    await db.execute(sql.raw(`
      CREATE POLICY "_system_meta_tenant_isolation" ON "_system_meta"
        USING (
          ${own}
          OR ("tenant_id" IS NULL AND (${current} IS NULL OR "key" IN (${keys})))
        )
        WITH CHECK (
          ${own}
          OR ("tenant_id" IS NULL AND current_setting('app.platform_admin', true) = 'on')
        )
    `));
  }
}
