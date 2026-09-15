import { describe, expect, it } from 'vitest';
import { TenantIsolationSql } from '@database/dialects/postgres/tenant/tenant-isolation-sql';
import type { ITenantPolicySpec } from '@database/interfaces/tenant-isolation.interface';

/**
 * What the driver RENDERS from a bespoke policy declaration.
 *
 * These assertions used to live in core, beside the class that built the SQL. The SQL moved here, so
 * they did too — every one of them is preserved, because each is a rule that was got wrong once.
 * Core's own test now asserts the declarations (`tenant-bespoke-policies.test.ts`).
 */
describe('TenantIsolationSql.bespokePolicyStatements', () => {
  const render = (spec: ITenantPolicySpec) => TenantIsolationSql.bespokePolicyStatements(spec);
  const sqlFor = (spec: ITenantPolicySpec) => render(spec).join('\n');

  const MEDIA: ITenantPolicySpec = { table: 'media', kind: 'shared-read', sharedColumn: 'shared' };
  const META: ITenantPolicySpec = {
    table: '_system_meta',
    kind: 'platform-keys-visible',
    keyColumn: 'key',
    platformKeys: ['maintenance_mode', 'site_url'],
  };
  const JOURNAL: ITenantPolicySpec = { table: '_system_logs', kind: 'journal' };
  const SETTINGS: ITenantPolicySpec = { table: '_system_plugin_settings', kind: 'tenant-settings' };

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

  it('lets a PLATFORM admin read a journal, and an UNTENANTED connection write one', () => {
    const sql = sqlFor(JOURNAL);
    // Boot, migrations and platform actions all log before any tenant is bound; requiring the
    // marker on write would refuse exactly the entries a journal exists to keep.
    expect(sql).toContain("USING (\"tenant_id\" = nullif(current_setting('app.tenant_id', true), '') OR current_setting('app.platform_admin', true) = 'on'");
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
    expect(() => render({ ...MEDIA, table: 'media"; DROP TABLE users; --' })).toThrow(/not a plain SQL identifier/);
  });

  it('refuses a settings key that is not a safe literal', () => {
    // These come from a compile-time registry today, but a policy body is the last place to rely on
    // that: the key is interpolated, not parameterised.
    expect(() => render({ ...META, platformKeys: ["x' OR '1'='1"] })).toThrow(/not a safe policy literal/);
  });
});
