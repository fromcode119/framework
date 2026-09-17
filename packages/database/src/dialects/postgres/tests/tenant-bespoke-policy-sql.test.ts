import { describe, expect, it } from 'vitest';
import { TenantIsolationSql } from '@database/dialects/postgres/tenant/tenant-isolation-sql';
import { JournalPolicySpec } from '@database/tenant/policies/journal-policy-spec';
import { PlatformKeysVisiblePolicySpec } from '@database/tenant/policies/platform-keys-visible-policy-spec';
import { SharedReadPolicySpec } from '@database/tenant/policies/shared-read-policy-spec';
import { TenantSettingsPolicySpec } from '@database/tenant/policies/tenant-settings-policy-spec';
import { UnownedReadPolicySpec } from '@database/tenant/policies/unowned-read-policy-spec';
import type { TenantPolicySpec } from '@database/tenant/policies/tenant-policy-spec';

/**
 * What the driver RENDERS from a bespoke policy declaration.
 *
 * These assertions used to live in core, beside the class that built the SQL. The SQL moved here, so
 * they did too — every one of them is preserved, because each is a rule that was got wrong once.
 * Core's own test now asserts the declarations (`tenant-bespoke-policies.test.ts`).
 */
describe('TenantIsolationSql.bespokePolicyStatements', () => {
  const render = (spec: TenantPolicySpec) => TenantIsolationSql.bespokePolicyStatements(spec);
  const sqlFor = (spec: TenantPolicySpec) => render(spec).join('\n');

  const MEDIA = new SharedReadPolicySpec('media', 'shared');
  const META = new PlatformKeysVisiblePolicySpec('_system_meta', 'key', ['maintenance_mode', 'site_url']);
  const JOURNAL = new JournalPolicySpec('_system_logs');
  const SETTINGS = new TenantSettingsPolicySpec('_system_plugin_settings');
  const UNOWNED = new UnownedReadPolicySpec('_system_email_suppressions');

  it('gives a shared-read table FOUR per-command policies, because WITH CHECK does not govern DELETE', () => {
    const sql = sqlFor(MEDIA);
    // A single `USING (own OR shared) WITH CHECK (own)` would let a borrower DELETE another
    // tenant's shared asset: DELETE falls back to USING. Sharing must widen reads and nothing else.
    expect(sql).toContain('FOR SELECT USING ("tenant_id" = nullif(current_setting(\'app.tenant_id\', true), \'\') OR "shared" IS TRUE)');
    expect(sql).toContain('FOR INSERT WITH CHECK');
    expect(sql).toContain('FOR UPDATE USING');
    expect(sql).toContain('FOR DELETE USING');
    expect(sql).not.toContain('FOR DELETE USING ("tenant_id" = nullif(current_setting(\'app.tenant_id\', true), \'\') OR "shared" IS TRUE)');
  });

  /**
   * The do-not-email list, where losing a row is the dangerous direction.
   *
   * The generic predicate is strict equality, so an unowned row matches in NO scope — for this table
   * that means silently resuming mail to someone who asked not to receive it. `unowned-read` widens
   * the READ to unowned rows and nothing else.
   */
  it('lets every tenant READ an unowned row, so a suppression nobody owns keeps applying', () => {
    const sql = sqlFor(UNOWNED);
    expect(sql).toContain('FOR SELECT USING ("tenant_id" = nullif(current_setting(\'app.tenant_id\', true), \'\') OR "tenant_id" IS NULL)');
  });

  it('lets NOBODY write an unowned row — not even to delete it', () => {
    const sql = sqlFor(UNOWNED);
    // Same trap as shared-read: DELETE falls back to USING, so a single `USING (own OR unowned)`
    // would let any tenant delete every unowned suppression on the platform.
    expect(sql).toContain('FOR DELETE USING ("tenant_id" = nullif(current_setting(\'app.tenant_id\', true), \'\'))');
    expect(sql).not.toContain('FOR DELETE USING ("tenant_id" = nullif(current_setting(\'app.tenant_id\', true), \'\') OR "tenant_id" IS NULL)');
    expect(sql).not.toContain('FOR UPDATE USING ("tenant_id" = nullif(current_setting(\'app.tenant_id\', true), \'\') OR "tenant_id" IS NULL)');
    expect(sql).not.toContain('FOR INSERT WITH CHECK ("tenant_id" = nullif(current_setting(\'app.tenant_id\', true), \'\') OR "tenant_id" IS NULL)');
  });

  it('still stamps NEW rows with the current tenant, so widening reads does not make new rows global', () => {
    const sql = sqlFor(UNOWNED);
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "tenant_id" TEXT DEFAULT nullif(current_setting(\'app.tenant_id\', true), \'\')');
    expect(sql).toContain('FORCE ROW LEVEL SECURITY');
  });

  it('lets a tenant read platform settings ONLY for the declared deployment truths', () => {
    const sql = sqlFor(META);
    expect(sql).toContain("'maintenance_mode'");
    expect(sql).toContain("'site_url'");
    // Anything a tenant owns must not be readable from the platform row, or one key resolves to two
    // visible rows and findOne picks whichever the planner returns.
    expect(sql).not.toContain("'site_name'");
  });

  it('keeps a deployment with NO tenants able to read its own settings', () => {
    // Without this branch, narrowing to the platform-key list would hide every other setting from
    // every installation that has no tenants — which is every installation before it migrates.
    expect(sqlFor(META)).toContain("nullif(current_setting('app.tenant_id', true), '') IS NULL");
  });

  it('writes a platform-level row only for a connection marked as a platform admin', () => {
    expect(sqlFor(META)).toContain("current_setting('app.platform_admin', true) = 'on'");
    expect(sqlFor(SETTINGS)).toContain("current_setting('app.platform_admin', true) = 'on'");
  });

  it('drops each policy before creating it, since CREATE POLICY has no IF NOT EXISTS', () => {
    const statements = render(MEDIA);
    const dropIndex = statements.findIndex((s) => s.includes('DROP POLICY IF EXISTS "media_tenant_select"'));
    const createIndex = statements.findIndex((s) => s.includes('CREATE POLICY "media_tenant_select"'));
    expect(dropIndex).toBeGreaterThanOrEqual(0);
    expect(createIndex).toBeGreaterThan(dropIndex);
  });

  it('enables AND forces row level security for every kind of bespoke policy', () => {
    for (const spec of [MEDIA, META, JOURNAL, SETTINGS]) {
      const sql = sqlFor(spec);
      // FORCE matters: without it the table OWNER bypasses the policy and reads every tenant's rows
      // with everything still looking healthy.
      expect(sql).toContain(`ALTER TABLE "${spec.table}" ENABLE ROW LEVEL SECURITY`);
      expect(sql).toContain(`ALTER TABLE "${spec.table}" FORCE ROW LEVEL SECURITY`);
    }
  });

  it('guards every bespoke predicate with nullif, exactly like the generic one', () => {
    for (const spec of [MEDIA, META, JOURNAL, SETTINGS]) {
      const sql = sqlFor(spec);
      expect(sql).toContain('nullif(');
      // A bare comparison makes `'' = ''` true, and a released pooled connection reset to `''`
      // would land every stray query in a readable, writable phantom tenant.
      expect(sql).not.toMatch(/=\s*current_setting\('app\.tenant_id',\s*true\)\s*\)/);
    }
  });

  it('lets a PLATFORM admin read a journal FROM THE PLATFORM SCOPE, and an UNTENANTED connection write one', () => {
    const sql = sqlFor(JOURNAL);
    // Boot, migrations and platform actions all log before any tenant is bound; requiring the
    // marker on write would refuse exactly the entries a journal exists to keep.
    //
    // The read marker is paired with "no tenant bound". Unpaired it overrode a BOUND site, so an
    // operator standing in one customer read every other customer's journal — measured on a live
    // database before this changed. Isolation is not conditional on who is asking.
    expect(sql).toContain("USING (\"tenant_id\" = nullif(current_setting('app.tenant_id', true), '') OR (current_setting('app.platform_admin', true) = 'on' AND nullif(current_setting('app.tenant_id', true), '') IS NULL)");
    expect(sql).toContain('WITH CHECK ("tenant_id" = nullif(current_setting(\'app.tenant_id\', true), \'\') OR ("tenant_id" IS NULL AND nullif(current_setting(\'app.tenant_id\', true), \'\') IS NULL))');
  });

  it('a journal is NOT readable by another tenant merely for being untenanted', () => {
    // The platform marker is set deliberately (`db.withPlatformAdmin`), never by absence of a tenant.
    const sql = sqlFor(JOURNAL);
    expect(sql).toContain('"tenant_id" IS NULL AND nullif(current_setting(\'app.tenant_id\', true), \'\') IS NULL');
  });

  it('plugin settings admit NO shared keys — a plugin\'s configuration is never platform-level', () => {
    expect(sqlFor(SETTINGS)).not.toContain(' IN (');
  });

  it('refuses a table name that is not a plain identifier, rather than building the DDL', () => {
    expect(() => render(new SharedReadPolicySpec('media"; DROP TABLE users; --', 'shared'))).toThrow(/not a plain SQL identifier/);
  });

  it('refuses a settings key that is not a safe literal', () => {
    // These come from a compile-time registry today, but a policy body is the last place to rely on
    // that: the key is interpolated, not parameterised.
    expect(() => render(new PlatformKeysVisiblePolicySpec('_system_meta', 'key', ["x' OR '1'='1"]))).toThrow(/not a safe policy literal/);
  });
});
