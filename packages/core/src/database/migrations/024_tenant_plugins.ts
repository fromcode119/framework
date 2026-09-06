import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '@core/database/helpers/dialect';

/**
 * Per-tenant plugin enablement.
 *
 * INSTALLATION IS PLATFORM-WIDE; ENABLEMENT IS PER TENANT. One container, one filesystem, one copy
 * of the code — a tenant cannot install code, it can only turn on code the operator already
 * installed. So `_system_plugins` keeps every installation fact (on disk, version, integrity,
 * signature, held) and this table answers only "does tenant T run this plugin".
 *
 * This table is NOT tenant-scoped by row-level security, and that is deliberate rather than an
 * omission — the same rule that keeps `users`, memberships and sessions unscoped. It is read to
 * DECIDE what a tenant may do, including on paths that legitimately read across tenants (the
 * platform-wide plugin list), so a policy here would be circular. It is protected the way
 * `_system_tenants` is: only the framework reads it, never a plugin, and every read passes an
 * explicit tenant id.
 */
export class TenantPluginsMigration extends BaseMigration {
  readonly version = 24;
  readonly name = 'Per-tenant plugin enablement and per-tenant plugin settings';

  async up(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await TenantPluginsMigration.createTable(db, 'TIMESTAMP');
        await TenantPluginsMigration.backfillFromActivePlugins(db);

        await TenantPluginsMigration.scopePluginSettings(db);
      },
      sqlite: async () => {
        await TenantPluginsMigration.createTable(db, 'DATETIME');
        await TenantPluginsMigration.backfillFromActivePlugins(db);
        // No row-level security on SQLite; isolation there is file-per-tenant (see the S1 spec).
      },
    });
  }

  /**
   * Two tenants running the same plugin configure it independently — without this, "per-tenant
   * plugins" would still share one configuration.
   *
   * The primary key has to be widened FIRST, and that is not a detail. `_system_plugin_settings` is
   * keyed on `plugin_slug` alone, so the second tenant to save settings for a plugin would get
   * `duplicate key value violates unique constraint` — the identical defect this migration's
   * predecessor (023) had to fix in `_system_meta`, where it made per-tenant settings impossible
   * while every isolation test still passed.
   */
  private static async scopePluginSettings(db: IDatabaseManager): Promise<void> {
    await db.execute(sql.raw(
      'ALTER TABLE "_system_plugin_settings" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT '
      + "DEFAULT nullif(current_setting('app.tenant_id', true), '')",
    ));
    await db.execute(sql.raw(
      'CREATE INDEX IF NOT EXISTS "_system_plugin_settings_tenant_idx" '
      + 'ON "_system_plugin_settings" ("tenant_id")',
    ));

    // NULLS NOT DISTINCT keeps the pre-tenancy row unique per plugin; without it Postgres treats
    // every NULL as distinct and duplicates would accumulate unseen.
    await db.execute(sql.raw(
      'ALTER TABLE "_system_plugin_settings" DROP CONSTRAINT IF EXISTS "_system_plugin_settings_pkey"',
    ));
    await db.execute(sql.raw(
      'ALTER TABLE "_system_plugin_settings" ADD CONSTRAINT "_system_plugin_settings_pkey" '
      + 'UNIQUE NULLS NOT DISTINCT ("plugin_slug", "tenant_id")',
    ));

    // Every existing tenant inherits the configuration in force today, so enabling per-tenant plugin
    // settings changes nobody's behaviour on the day it runs.
    await db.execute(sql.raw(`
      INSERT INTO "_system_plugin_settings" ("plugin_slug", "settings", "tenant_id")
      SELECT s."plugin_slug", s."settings", t."id"
      FROM "_system_plugin_settings" s
      CROSS JOIN "_system_tenants" t
      WHERE s."tenant_id" IS NULL
      ON CONFLICT DO NOTHING
    `));

    await db.execute(sql.raw('ALTER TABLE "_system_plugin_settings" ENABLE ROW LEVEL SECURITY'));
    await db.execute(sql.raw('ALTER TABLE "_system_plugin_settings" FORCE ROW LEVEL SECURITY'));
    await db.execute(sql.raw(
      'DROP POLICY IF EXISTS "_system_plugin_settings_tenant_isolation" ON "_system_plugin_settings"',
    ));

    // The second branch of USING is what keeps a deployment with NO tenants working: nothing binds a
    // tenant there, so without it every plugin would read back an empty configuration and silently
    // fall to its schema defaults. Unlike `_system_meta` there is no list of shared keys — a plugin's
    // configuration is never platform-level once tenants exist.
    const current = `nullif(current_setting('app.tenant_id', true), '')`;
    await db.execute(sql.raw(`
      CREATE POLICY "_system_plugin_settings_tenant_isolation" ON "_system_plugin_settings"
        USING ("tenant_id" = ${current} OR ("tenant_id" IS NULL AND ${current} IS NULL))
        WITH CHECK (
          "tenant_id" = ${current}
          OR ("tenant_id" IS NULL AND current_setting('app.platform_admin', true) = 'on')
        )
    `));
  }

  private static async createTable(db: IDatabaseManager, timestamp: string): Promise<void> {
    // No foreign keys: `_system_plugins` rows come and go with installation, and a tenant row can be
    // removed by T4. A dangling enablement row is harmless (the plugin is not loadable, so the
    // platform axis refuses it anyway), whereas an FK would make uninstalling a plugin fail while
    // any tenant still has a row for it — turning a routine operator action into a puzzle.
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "_system_tenant_plugins" (
        "tenant_id" TEXT NOT NULL,
        "plugin_slug" TEXT NOT NULL,
        "state" TEXT NOT NULL DEFAULT 'active',
        "enabled_at" ${timestamp},
        "updated_at" ${timestamp} DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "_system_tenant_plugins_pk" PRIMARY KEY ("tenant_id", "plugin_slug")
      )
    `));

    await db.execute(sql.raw(
      'CREATE INDEX IF NOT EXISTS "_system_tenant_plugins_tenant_idx" '
      + 'ON "_system_tenant_plugins" ("tenant_id")',
    ));
  }

  /**
   * Every plugin that is active today is enabled for every tenant that exists today.
   *
   * This is the whole difference between a migration and an outage. Without it, the moment the new
   * per-tenant gate goes live, no tenant has a row for anything and every plugin turns off at once
   * for every customer — while the admin still reports them all "active" on the platform axis.
   */
  private static async backfillFromActivePlugins(db: IDatabaseManager): Promise<void> {
    await db.execute(sql.raw(`
      INSERT INTO "_system_tenant_plugins" ("tenant_id", "plugin_slug", "state", "enabled_at")
      SELECT t."id", p."slug", 'active', CURRENT_TIMESTAMP
      FROM "_system_tenants" t
      CROSS JOIN "_system_plugins" p
      WHERE p."state" = 'active'
      ON CONFLICT DO NOTHING
    `));
  }
}
