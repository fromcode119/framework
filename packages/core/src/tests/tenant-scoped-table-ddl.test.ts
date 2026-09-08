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

  it('does NOT scope framework identity and configuration tables — that is T1/T2', () => {
    for (const table of [
      '_system_tenants', '_system_plugins', '_system_plugin_settings', '_system_themes',
      '_system_sessions', '_system_meta', '_system_roles', '_system_users_roles', 'users',
      'people', 'people_addresses',
    ]) {
      expect(TenantScopedTableDdl.isTenantScoped(table)).toBe(false);
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
