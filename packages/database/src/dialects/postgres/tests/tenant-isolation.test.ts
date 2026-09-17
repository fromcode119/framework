import { describe, expect, it } from 'vitest';
import { PostgresTenantIsolation } from '@database/dialects/postgres/tenant/tenant-isolation';
import { TenantIsolationSql } from '@database/dialects/postgres/tenant/tenant-isolation-sql';
import { RefusingTenantIsolation } from '@database/tenant/refusing-tenant-isolation';
import { SharedReadPolicySpec } from '@database/tenant/policies/shared-read-policy-spec';

/**
 * The executing half. The statements themselves are asserted in `tenant-isolation-sql.test.ts`;
 * what matters here is that this class issues EXACTLY those statements, in that order, and nothing
 * else — the whole point of moving execution behind an interface is that a caller can no longer see
 * what is run, so the seam itself has to be held down.
 */
describe('PostgresTenantIsolation', () => {
  const recorder = (rows: Array<Record<string, unknown>> = []) => {
    const issued: Array<{ text: string; values?: unknown[] }> = [];
    const run = async (text: string, values?: unknown[]) => {
      issued.push({ text, values });
      return rows;
    };
    return { issued, run };
  };

  it('isolateTable issues the column half then the enforcement half, in order', async () => {
    const { issued, run } = recorder();

    await new PostgresTenantIsolation(run).isolateTable('pages');

    expect(issued.map((entry) => entry.text)).toEqual(TenantIsolationSql.statementsFor('pages'));
  });

  it('addTenantColumn never enables row-level security', async () => {
    const { issued, run } = recorder();

    await new PostgresTenantIsolation(run).addTenantColumn('pages');

    const all = issued.map((entry) => entry.text).join(' ');
    expect(all).not.toContain('ROW LEVEL SECURITY');
    expect(all).not.toContain('CREATE POLICY');
  });

  it('releaseTable drops the named policies and keeps the column', async () => {
    const { issued, run } = recorder();

    await new PostgresTenantIsolation(run).releaseTable('pages', ['pages_tenant_isolation']);

    const all = issued.map((entry) => entry.text).join(' ');
    expect(all).toContain('DROP POLICY IF EXISTS "pages_tenant_isolation"');
    expect(all).toContain('NO FORCE ROW LEVEL SECURITY');
    // Dropping it would destroy the ownership of every row written while there WERE tenants.
    expect(all).not.toContain('DROP COLUMN');
  });

  it('listPolicies drops rows the catalog returns without a table or a policy name', async () => {
    const { run } = recorder([
      { tablename: 'pages', policyname: 'pages_tenant_isolation' },
      { tablename: '', policyname: 'orphan' },
      { tablename: 'media', policyname: '   ' },
    ]);

    expect(await new PostgresTenantIsolation(run).listPolicies())
      .toEqual([{ table: 'pages', policy: 'pages_tenant_isolation' }]);
  });

  it('scopeUniqueRules rewrites what the catalog reports and says what it rewrote', async () => {
    const { issued, run } = recorder([{ name: 'pages_slug_key', columns: ['slug'] }]);

    const scoped = await new PostgresTenantIsolation(run).scopeUniqueRules('pages');

    expect(scoped.constraints).toEqual([{ name: 'pages_slug_key', columns: ['slug'] }]);
    expect(issued.map((entry) => entry.text)).toContain(
      TenantIsolationSql.scopeUniqueConstraintStatement('pages', 'pages_slug_key', ['slug']),
    );
  });

  it('reads the tenant column out of pg\'s `{a,b}` array text as well as a JS array', async () => {
    const { run } = recorder([{ name: 'pages_slug_key', columns: '{slug,locale}' }]);

    const scoped = await new PostgresTenantIsolation(run).scopeUniqueRules('pages');

    expect(scoped.constraints[0].columns).toEqual(['slug', 'locale']);
  });

  it('countUnassigned reports the number the catalog returns', async () => {
    const { run } = recorder([{ unassigned: 7 }]);

    expect(await new PostgresTenantIsolation(run).countUnassigned('pages')).toBe(7);
  });

  it('assignUnassigned counts BEFORE it writes — an UPDATE reports no rows back', async () => {
    const { issued, run } = recorder([{ unassigned: 3 }]);

    expect(await new PostgresTenantIsolation(run).assignUnassigned('pages', 'acme')).toBe(3);
    expect(issued[0].text).toContain('SELECT count(*)');
    expect(issued[1].text).toContain('UPDATE "pages"');
    expect(issued[1].values).toEqual(['acme']);
  });
});

/**
 * The refusing default is a security property, so it gets its own assertion rather than being
 * assumed: a no-op here would let a caller on MySQL be told a table is isolated when every tenant
 * can read every row.
 */
describe('RefusingTenantIsolation', () => {
  it('refuses every method rather than doing nothing', async () => {
    const refusing = new RefusingTenantIsolation('MysqlDatabaseManager');

    await expect(refusing.isolateTable('pages')).rejects.toThrow(/no tenant isolation/);
    await expect(refusing.enforceIsolation('pages')).rejects.toThrow(/no tenant isolation/);
    await expect(refusing.addTenantColumn('pages')).rejects.toThrow(/no tenant isolation/);
    await expect(refusing.listPolicies()).rejects.toThrow(/no tenant isolation/);
    await expect(refusing.scopeUniqueRules('pages')).rejects.toThrow(/no tenant isolation/);
    await expect(refusing.countUnassigned('pages')).rejects.toThrow(/no tenant isolation/);
    await expect(refusing.applyPolicy(new SharedReadPolicySpec('media', 'shared')))
      .rejects.toThrow(/no tenant isolation/);
  });

  it('names the driver, so the message says which deployment cannot do this', async () => {
    await expect(new RefusingTenantIsolation('SqliteDatabaseManager').isolateTable('pages'))
      .rejects.toThrow(/SqliteDatabaseManager/);
  });
});
