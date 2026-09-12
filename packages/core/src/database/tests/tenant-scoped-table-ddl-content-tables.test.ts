import { describe, expect, it } from 'vitest';
import { TenantScopedTableDdl } from '@core/database/tenant-scoped-table-ddl';

/**
 * The framework tables that hold a tenant's CONTENT, and the ones that must stay platform-wide.
 *
 * The people tables and `_system_redirects` were scoped by migrations 021 and 030 and by nothing
 * else — so when `removeTenantIsolation` dropped every `%_tenant_%` policy on a deployment with no
 * tenants, they lost theirs for good; a migration does not run twice. Measured on a deployment that
 * had been single-tenant and was then adopted: all five had a `tenant_id` column and no policy, so
 * every tenant could read every other tenant's people, and one site's redirects fired on all of
 * them. Naming them here is what lets the sweep put back what it takes away.
 */
describe('TenantScopedTableDdl — which framework tables are a tenant\'s own', () => {
  const scoped = (table: string): boolean => TenantScopedTableDdl.isTenantScoped(table);

  it.each([
    'people',
    'people_addresses',
    'person_relationships',
    'person_catalogs',
    '_system_redirects',
    'media_folders',
  ])('scopes %s — it holds one tenant\'s content', (table) => {
    expect(scoped(table)).toBe(true);
  });

  it.each([
    'users',           // who can log in is a platform fact
    '_system_tenants', // the tenant list cannot be scoped by tenant
    '_system_meta',    // platform settings; also has a bespoke policy
    'media',           // bespoke: admits shared assets too
  ])('does not scope %s — it is platform-wide or bespoke', (table) => {
    expect(scoped(table)).toBe(false);
  });

  it('emits real DDL for a carved-in _system_ table, which the name rule alone would refuse', () => {
    const statements = TenantScopedTableDdl.statementsFor('_system_redirects');

    expect(statements.length).toBeGreaterThan(0);
    expect(statements.join(' ')).toContain('_system_redirects');
  });

  it('still refuses a collection marked system, whatever it is called', () => {
    expect(TenantScopedTableDdl.isTenantScoped('settings', { system: true })).toBe(false);
  });
});
