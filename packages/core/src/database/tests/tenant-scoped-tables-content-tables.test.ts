import { describe, expect, it } from 'vitest';
import { TenantScopedTables } from '@core/database/tenant-scoped-tables';

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
describe('TenantScopedTables — which framework tables are a tenant\'s own', () => {
  const scoped = (table: string): boolean => TenantScopedTables.isTenantScoped(table);

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

  it('scopes a carved-in _system_ table, which the name rule alone would refuse', () => {
    // `_system_redirects` is a tenant's own content despite the prefix. Getting this wrong left one
    // site's redirects firing on every other site.
    expect(TenantScopedTables.isTenantScoped('_system_redirects')).toBe(true);
  });

  it('still refuses a collection marked system, whatever it is called', () => {
    expect(TenantScopedTables.isTenantScoped('settings', { system: true })).toBe(false);
  });
});
