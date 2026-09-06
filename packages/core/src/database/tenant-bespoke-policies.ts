import { TenantRlsSql } from '@fromcode119/database';

/**
 * The tenant policies that are NOT the generic one, in the one place that defines them.
 *
 * Three tables need a policy the generic `tenant_id = current_tenant` cannot express:
 *
 *   media                    — a shared asset is READABLE by every tenant and writable by none but
 *                              its owner, so it needs four per-command policies (WITH CHECK does not
 *                              govern DELETE, so a single policy would let a borrower delete another
 *                              customer's file).
 *   _system_meta             — a tenant may read the handful of deployment truths it cannot own.
 *   _system_plugin_settings  — per tenant, with the untenanted branch that keeps a deployment with
 *                              no tenants working.
 *
 * WHY THIS IS NOT LEFT IN THE MIGRATIONS THAT INTRODUCED IT: migrations run once. A deployment that
 * has no tenants has its policies REMOVED (see `SchemaManager.removeTenantIsolation`, which exists
 * because a policy with no tenant bound matches no row and empties the site). If it later gains a
 * tenant, the boot sweep re-applies the generic policies — but a migration that already ran will
 * never run again, so `media` and the two settings tables would come back UNPROTECTED, silently.
 * Defining them here and applying them from the sweep makes the transition self-healing in both
 * directions, and keeps one definition rather than two that can drift apart.
 */
export class TenantBespokePolicies {
  /** Deployment truths a tenant cannot own — the only keys readable from the platform row. */
  private static readonly PLATFORM_KEYS = [
    'marketplace_url', 'admin_url', 'frontend_url', 'site_url',
    'maintenance_mode', 'setup_completed',
    // How many server-render worlds the storefront keeps resident — infrastructure, read on every
    // tenant-bound `/system/frontend` request, so it must be visible from a tenant connection.
    'ssr_generation_cap',
    // Plugin isolation (T5): a process model is a platform truth, and the host reads it at boot.
    'plugin_isolation_default', 'plugin_isolation_memory_mb', 'plugin_isolation_timeout_ms',
    'ssr_render_memory_mb', 'ssr_render_timeout_ms',
  ];

  /** The platform keys, for the code that must NOT hand them to a tenant — the tenant importer. */
  static platformKeys(): string[] {
    return [...TenantBespokePolicies.PLATFORM_KEYS];
  }

  private static readonly CURRENT = `nullif(current_setting('${TenantRlsSql.SETTING}', true), '')`;

  /** Every table this class owns the policy for. The generic sweep must skip exactly these. */
  static tables(): string[] {
    return ['media', '_system_meta', '_system_plugin_settings'];
  }

  /** Every statement needed to bring all three under their own policies. Idempotent. */
  static statements(): string[] {
    return [
      ...TenantBespokePolicies.mediaStatements(),
      ...TenantBespokePolicies.settingsStatements(),
      ...TenantBespokePolicies.pluginSettingsStatements(),
    ];
  }

  /**
   * FOUR policies, one per command, because `WITH CHECK` does not govern DELETE.
   *
   * A single `USING (own OR shared) WITH CHECK (own)` looks right and is not: DELETE falls back to
   * USING, so a borrower could delete another tenant's shared asset out from under them. Sharing
   * must widen READS and nothing else.
   */
  private static mediaStatements(): string[] {
    const own = `"tenant_id" = ${TenantBespokePolicies.CURRENT}`;
    const names = ['media_tenant_isolation', 'media_tenant_select', 'media_tenant_insert',
                   'media_tenant_update', 'media_tenant_delete'];
    return [
      'ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT '
        + `DEFAULT ${TenantBespokePolicies.CURRENT}`,
      'CREATE INDEX IF NOT EXISTS "media_tenant_id_idx" ON "media" ("tenant_id")',
      'ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "shared" BOOLEAN NOT NULL DEFAULT FALSE',
      'ALTER TABLE "media" ENABLE ROW LEVEL SECURITY',
      'ALTER TABLE "media" FORCE ROW LEVEL SECURITY',
      ...names.map((name) => `DROP POLICY IF EXISTS "${name}" ON "media"`),
      `CREATE POLICY "media_tenant_select" ON "media" FOR SELECT USING (${own} OR "shared" IS TRUE)`,
      `CREATE POLICY "media_tenant_insert" ON "media" FOR INSERT WITH CHECK (${own})`,
      `CREATE POLICY "media_tenant_update" ON "media" FOR UPDATE USING (${own}) WITH CHECK (${own})`,
      `CREATE POLICY "media_tenant_delete" ON "media" FOR DELETE USING (${own})`,
    ];
  }

  /**
   * A tenant sees a platform row only for the deployment truths above, so one key never resolves to
   * two visible rows and `findOne(META, { key })` is unambiguous. The `IS NULL` branch keeps a
   * deployment with no tenants reading all of its own settings.
   */
  private static settingsStatements(): string[] {
    const keys = TenantBespokePolicies.PLATFORM_KEYS.map((key) => `'${key}'`).join(', ');
    const current = TenantBespokePolicies.CURRENT;
    const own = `"tenant_id" = ${current}`;
    return [
      'ALTER TABLE "_system_meta" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT',
      // The DEFAULT is load-bearing and was missing. Migration 022 added the column without one, so
      // ANY write that did not name a tenant — which is most of them, since callers use
      // `db.insert(META, { key, value })` — landed a NULL, i.e. a PLATFORM row. Under the policy
      // that is refused outright ("new row violates row-level security policy"), which is how
      // enabling a plugin failed while merely reading settings looked perfectly healthy.
      // With the default, a tenant-bound connection writes the tenant's own row, and an untenanted
      // one (boot, single-tenant) still writes the platform row it means to.
      'ALTER TABLE "_system_meta" ALTER COLUMN "tenant_id" SET DEFAULT '
        + TenantBespokePolicies.CURRENT,
      'CREATE INDEX IF NOT EXISTS "_system_meta_tenant_idx" ON "_system_meta" ("tenant_id")',
      'ALTER TABLE "_system_meta" ENABLE ROW LEVEL SECURITY',
      'ALTER TABLE "_system_meta" FORCE ROW LEVEL SECURITY',
      'DROP POLICY IF EXISTS "_system_meta_tenant_isolation" ON "_system_meta"',
      `CREATE POLICY "_system_meta_tenant_isolation" ON "_system_meta"
         USING (${own} OR ("tenant_id" IS NULL AND (${current} IS NULL OR "key" IN (${keys}))))
         WITH CHECK (
           ${own}
           OR ("tenant_id" IS NULL AND current_setting('app.platform_admin', true) = 'on')
         )`,
    ];
  }

  /** Per tenant with no shared keys: a plugin's configuration is never platform-level. */
  private static pluginSettingsStatements(): string[] {
    const current = TenantBespokePolicies.CURRENT;
    const own = `"tenant_id" = ${current}`;
    return [
      'ALTER TABLE "_system_plugin_settings" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT '
        + `DEFAULT ${current}`,
      'CREATE INDEX IF NOT EXISTS "_system_plugin_settings_tenant_idx" '
        + 'ON "_system_plugin_settings" ("tenant_id")',
      'ALTER TABLE "_system_plugin_settings" ENABLE ROW LEVEL SECURITY',
      'ALTER TABLE "_system_plugin_settings" FORCE ROW LEVEL SECURITY',
      'DROP POLICY IF EXISTS "_system_plugin_settings_tenant_isolation" ON "_system_plugin_settings"',
      `CREATE POLICY "_system_plugin_settings_tenant_isolation" ON "_system_plugin_settings"
         USING (${own} OR ("tenant_id" IS NULL AND ${current} IS NULL))
         WITH CHECK (
           ${own}
           OR ("tenant_id" IS NULL AND current_setting('app.platform_admin', true) = 'on')
         )`,
    ];
  }
}
