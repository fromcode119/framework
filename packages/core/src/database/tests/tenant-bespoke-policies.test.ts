import { describe, expect, it } from 'vitest';
import { TenantBespokePolicies } from '@core/database/tenant-bespoke-policies';

describe('TenantBespokePolicies', () => {
  const statements = TenantBespokePolicies.statements();
  const sql = statements.join('\n');

  it('gives media FOUR per-command policies, because WITH CHECK does not govern DELETE', () => {
    // A single `USING (own OR shared) WITH CHECK (own)` would let a borrower DELETE another
    // tenant's shared asset: DELETE falls back to USING. Sharing must widen reads and nothing else.
    expect(sql).toContain('FOR SELECT USING ("tenant_id" = nullif(current_setting(\'app.tenant_id\', true), \'\') OR "shared" IS TRUE)');
    expect(sql).toContain('FOR INSERT WITH CHECK');
    expect(sql).toContain('FOR UPDATE USING');
    expect(sql).toContain('FOR DELETE USING');
    expect(sql).not.toContain('FOR DELETE USING ("tenant_id" = nullif(current_setting(\'app.tenant_id\', true), \'\') OR "shared" IS TRUE)');
  });

  it('lets a tenant read platform settings ONLY for the declared deployment truths', () => {
    expect(sql).toContain("'maintenance_mode'");
    expect(sql).toContain("'site_url'");
    // Anything a tenant owns must not be readable from the platform row, or one key resolves to two
    // visible rows and findOne picks whichever the planner returns.
    expect(sql).not.toContain("'site_name'");
  });

  it('keeps a deployment with NO tenants able to read its own settings', () => {
    // Without this branch, narrowing to the platform-key list would hide every other setting from
    // every installation that has no tenants — which is every installation before it migrates.
    expect(sql).toContain("nullif(current_setting('app.tenant_id', true), '') IS NULL");
  });

  it('writes a platform-level row only for a connection marked as a platform admin', () => {
    expect(sql).toContain("current_setting('app.platform_admin', true) = 'on'");
  });

  it('drops each policy before creating it, since CREATE POLICY has no IF NOT EXISTS', () => {
    const dropIndex = statements.findIndex((s) => s.includes('DROP POLICY IF EXISTS "media_tenant_select"'));
    const createIndex = statements.findIndex((s) => s.includes('CREATE POLICY "media_tenant_select"'));
    expect(dropIndex).toBeGreaterThanOrEqual(0);
    expect(createIndex).toBeGreaterThan(dropIndex);
  });

  it('enables AND forces row level security on every table it owns', () => {
    for (const table of TenantBespokePolicies.tables()) {
      // FORCE matters: without it the table OWNER bypasses the policy and reads every tenant's rows
      // with everything still looking healthy.
      expect(sql).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      expect(sql).toContain(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
    }
  });
});
