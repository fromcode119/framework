import { describe, expect, it } from 'vitest';
import { TenantScopedTableDdl } from '@core/database/tenant-scoped-table-ddl';

describe('TenantScopedTableDdl.isTenantScoped', () => {
  it('scopes plugin tables', () => {
    expect(TenantScopedTableDdl.isTenantScoped('fcp_beta_orders')).toBe(true);
  });

  it('scopes content tables', () => {
    expect(TenantScopedTableDdl.isTenantScoped('pages')).toBe(true);
  });

  it('scopes media_folders, which is tenant CONTENT despite being a framework table', () => {
    expect(TenantScopedTableDdl.isTenantScoped('media_folders')).toBe(true);
  });

  it('leaves `media` to its own migration — its policy admits SHARED assets too', () => {
    // The generic policy would be wrong for media, and the boot sweep recreates policies, so
    // including it here would silently overwrite the sharing rule on every restart.
    expect(TenantScopedTableDdl.isTenantScoped('media')).toBe(false);
    expect(TenantScopedTableDdl.statementsFor('media')).toEqual([]);
  });

  it('does NOT scope framework IDENTITY and CONFIGURATION tables', () => {
    for (const table of [
      '_system_tenants', '_system_plugins', '_system_plugin_settings', '_system_themes',
      '_system_sessions', '_system_meta', '_system_roles', '_system_users_roles', 'users',
    ]) {
      expect(TenantScopedTableDdl.isTenantScoped(table)).toBe(false);
    }
  });

  /**
   * The people tables moved OUT of the list above, deliberately.
   *
   * They were left unscoped as a "T1/T2 decision with its own design work", and migrations 021/030
   * then scoped them anyway — but only once. `removeTenantIsolation` drops every `%_tenant_%` policy
   * on a deployment with no tenants, so a deployment that ran single-tenant on this build lost them
   * and nothing put them back: measured on one adopted into multi-tenancy, all four people tables
   * and `_system_redirects` had a tenant_id column and no policy, readable by every tenant. A
   * person is a tenant's contact, not a platform fact, so the sweep owns them now.
   */
  it('scopes the people tables and redirects — a tenant\'s own content, and self-healing here', () => {
    for (const table of ['people', 'people_addresses', 'person_relationships', 'person_catalogs', '_system_redirects']) {
      expect(TenantScopedTableDdl.isTenantScoped(table)).toBe(true);
    }
  });

  it('is case-insensitive and ignores surrounding whitespace', () => {
    expect(TenantScopedTableDdl.isTenantScoped('  _SYSTEM_PLUGINS ')).toBe(false);
    expect(TenantScopedTableDdl.isTenantScoped('  USERS ')).toBe(false);
  });

  it('does not scope an empty name', () => {
    expect(TenantScopedTableDdl.isTenantScoped('')).toBe(false);
  });

  it('emits FORCE RLS for a scoped table', () => {
    const stmts = TenantScopedTableDdl.statementsFor('fcp_beta_orders');
    expect(stmts.some((statement) => statement.includes('FORCE ROW LEVEL SECURITY'))).toBe(true);
  });

  it('emits nothing for an unscoped table', () => {
    expect(TenantScopedTableDdl.statementsFor('_system_plugins')).toEqual([]);
    expect(TenantScopedTableDdl.statementsFor('users')).toEqual([]);
  });
});
