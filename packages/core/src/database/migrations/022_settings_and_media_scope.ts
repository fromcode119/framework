import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '@core/database/helpers/dialect';

/**
 * Per-tenant settings, and media that can be deliberately shared.
 *
 * Two policies here are intentionally ASYMMETRIC — the `USING` clause is wider than the
 * `WITH CHECK`. That asymmetry is the whole safety mechanism:
 *
 *   settings — a tenant may READ a platform-level setting, and may never write one.
 *   media    — a tenant may READ a shared asset, and may never modify one it does not own.
 *
 * Without it, "shared" would mean "writable by everyone", which is a leak wearing a feature's
 * clothes.
 */
export class SettingsAndMediaScopeMigration extends BaseMigration {
  readonly version = 22;
  readonly name = 'Per-tenant settings and opt-in media sharing';

  /**
   * Deployment truths a tenant cannot own. Everything else is per-tenant, because site name,
   * locale, timezone and email config are what make two sites different sites.
   */
  private static readonly PLATFORM_KEYS = [
    'marketplace_url', 'admin_url', 'frontend_url', 'site_url',
    'maintenance_mode', 'setup_completed',
  ];

  async up(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await SettingsAndMediaScopeMigration.scopeSettings(db);
        await SettingsAndMediaScopeMigration.scopeMedia(db);
      },
      sqlite: async () => {
        await db.execute(sql.raw('ALTER TABLE "_system_meta" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT'));
        await db.execute(sql.raw('ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "shared" BOOLEAN NOT NULL DEFAULT FALSE'));
        // No row-level security on SQLite; isolation there is file-per-tenant (see the S1 spec).
      },
    });
  }

  /**
   * `tenant_id IS NULL` means PLATFORM-LEVEL. This is the one place on the platform where a NULL
   * carries meaning rather than being an accident, so the schema says so and the admin surfaces it.
   */
  private static async scopeSettings(db: IDatabaseManager): Promise<void> {
    await db.execute(sql.raw('ALTER TABLE "_system_meta" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT'));
    await db.execute(sql.raw(
      'CREATE INDEX IF NOT EXISTS "_system_meta_tenant_idx" ON "_system_meta" ("tenant_id")',
    ));

    // Existing rows predate tenancy and are deployment-wide truths, so they become platform-level
    // rather than being assigned to an arbitrary tenant. Anything a tenant should own is set again
    // per tenant from its own admin.
    const keys = SettingsAndMediaScopeMigration.PLATFORM_KEYS.map((key) => `'${key}'`).join(', ');
    await db.execute(sql.raw(
      `UPDATE "_system_meta" SET "tenant_id" = NULL WHERE "key" IN (${keys})`,
    ));

    await db.execute(sql.raw('ALTER TABLE "_system_meta" ENABLE ROW LEVEL SECURITY'));
    await db.execute(sql.raw('ALTER TABLE "_system_meta" FORCE ROW LEVEL SECURITY'));
    await db.execute(sql.raw('DROP POLICY IF EXISTS "_system_meta_tenant_isolation" ON "_system_meta"'));
    // WITH CHECK is wider than "own tenant" by exactly one case: a PLATFORM row, and only while the
    // connection has been marked as acting for a platform admin.
    //
    // Without that case a platform-level setting would be writable by nobody at all — not even the
    // schema owner — because `tenant_id IS NULL` can never equal the current tenant. The marker is a
    // separate GUC the framework sets only after verifying the account, so "may write platform
    // settings" is an explicit, inspectable state on the connection rather than an implicit
    // consequence of which role happens to be connected.
    await db.execute(sql.raw(`
      CREATE POLICY "_system_meta_tenant_isolation" ON "_system_meta"
        USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '') OR "tenant_id" IS NULL)
        WITH CHECK (
          "tenant_id" = nullif(current_setting('app.tenant_id', true), '')
          OR ("tenant_id" IS NULL AND current_setting('app.platform_admin', true) = 'on')
        )
    `));
  }

  /**
   * `shared` defaults to FALSE — sharing is always a deliberate act. `WITH CHECK` keeps every write
   * to the owning tenant, which is what makes a shared asset READ-ONLY to everyone else: a borrower
   * can display it and cannot change or delete another customer's file.
   */
  private static async scopeMedia(db: IDatabaseManager): Promise<void> {
    // The full sequence lives here, not in the generic sweep: media is excluded from that path
    // precisely so this policy is not overwritten on the next boot.
    await db.execute(sql.raw(
      'ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT '
      + "DEFAULT nullif(current_setting('app.tenant_id', true), '')",
    ));
    await db.execute(sql.raw('CREATE INDEX IF NOT EXISTS "media_tenant_id_idx" ON "media" ("tenant_id")'));
    await db.execute(sql.raw(
      'ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "shared" BOOLEAN NOT NULL DEFAULT FALSE',
    ));
    await db.execute(sql.raw('ALTER TABLE "media" ENABLE ROW LEVEL SECURITY'));
    await db.execute(sql.raw('ALTER TABLE "media" FORCE ROW LEVEL SECURITY'));

    // FOUR policies, one per command, because WITH CHECK does not govern DELETE.
    //
    // A single `USING (own OR shared) WITH CHECK (own)` policy looks right and is not: WITH CHECK
    // constrains INSERT and UPDATE only, so DELETE falls back to USING — and a borrower could delete
    // another tenant's shared asset out from under them. Sharing must widen READS and nothing else.
    const own = `"tenant_id" = nullif(current_setting('app.tenant_id', true), '')`;

    for (const name of ['media_tenant_isolation', 'media_tenant_select', 'media_tenant_insert',
                        'media_tenant_update', 'media_tenant_delete']) {
      await db.execute(sql.raw(`DROP POLICY IF EXISTS "${name}" ON "media"`));
    }

    await db.execute(sql.raw(
      `CREATE POLICY "media_tenant_select" ON "media" FOR SELECT USING (${own} OR "shared" IS TRUE)`,
    ));
    await db.execute(sql.raw(
      `CREATE POLICY "media_tenant_insert" ON "media" FOR INSERT WITH CHECK (${own})`,
    ));
    await db.execute(sql.raw(
      `CREATE POLICY "media_tenant_update" ON "media" FOR UPDATE USING (${own}) WITH CHECK (${own})`,
    ));
    await db.execute(sql.raw(
      `CREATE POLICY "media_tenant_delete" ON "media" FOR DELETE USING (${own})`,
    ));
  }
}
