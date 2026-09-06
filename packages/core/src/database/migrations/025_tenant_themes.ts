import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '@core/database/helpers/dialect';

/**
 * Per-tenant theme activation.
 *
 * INSTALLATION IS PLATFORM-WIDE; ACTIVATION IS PER TENANT — the same split T2 drew for plugins, for
 * the same reason: one container, one `themes/` directory, one copy of each theme's files. A tenant
 * chooses among what the operator installed; it cannot put files on disk.
 *
 * `_system_themes` (keyed on `slug` alone, one process-wide `active` row) stays exactly as it is and
 * keeps meaning "installed". Adding a `tenant_id` to it would have repeated the `_system_meta` mistake
 * from T1: one row per slug means two tenants could never both activate the same theme.
 *
 * Not tenant-scoped by row-level security — it is in the resolution path (read to decide what a tenant
 * renders with), the framework alone reads it, and every read names the tenant.
 */
export class TenantThemesMigration extends BaseMigration {
  readonly version = 25;
  readonly name = 'Per-tenant theme activation';

  async up(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await TenantThemesMigration.createTable(db, 'TIMESTAMP', 'JSONB');
        await TenantThemesMigration.backfillFromActiveTheme(db, 'JSONB');
      },
      sqlite: async () => {
        await TenantThemesMigration.createTable(db, 'DATETIME', 'TEXT');
        await TenantThemesMigration.backfillFromActiveTheme(db, 'TEXT');
      },
    });
  }

  private static async createTable(db: IDatabaseManager, timestamp: string, json: string): Promise<void> {
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "_system_tenant_themes" (
        "tenant_id" TEXT NOT NULL,
        "theme_slug" TEXT NOT NULL,
        "state" TEXT NOT NULL DEFAULT 'inactive',
        "config" ${json},
        "updated_at" ${timestamp} DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "_system_tenant_themes_pk" PRIMARY KEY ("tenant_id", "theme_slug")
      )
    `));
    await db.execute(sql.raw(
      'CREATE INDEX IF NOT EXISTS "_system_tenant_themes_tenant_idx" ON "_system_tenant_themes" ("tenant_id")',
    ));
  }

  /**
   * Every existing tenant gets the process-wide active theme — and its variable overrides — as its own
   * active row, so on the day this runs no storefront changes. A deployment with no tenants copies
   * nothing and keeps the single `activeTheme` it has today; a deployment with no active theme copies
   * nothing either, and that is the truth rather than an invented default.
   */
  private static async backfillFromActiveTheme(db: IDatabaseManager, json: string): Promise<void> {
    const configExpr = json === 'JSONB' ? 'p."config"' : 'p."config"';
    await db.execute(sql.raw(`
      INSERT INTO "_system_tenant_themes" ("tenant_id", "theme_slug", "state", "config")
      SELECT t."id", p."slug", 'active', ${configExpr}
      FROM "_system_tenants" t
      CROSS JOIN "_system_themes" p
      WHERE p."state" = 'active'
      ON CONFLICT DO NOTHING
    `));
  }
}
