import { describe, expect, it } from 'vitest';
import { SystemConstants } from '@core/constants/system.constants';
import { TenantScopedTables } from '@core/database/tenant-scoped-tables';

/**
 * Private file delivery belongs to the site that sent it.
 *
 * A SHARE is one site's send of its own files; a GRANT is one recipient's access to it; the ACCESS
 * LOG is who opened what. None of the three was scoped — no `tenant_id`, no policy — while the admin
 * routes that list them query with no filter and are guarded by `admin`, which is what a SITE's own
 * administrator holds. One customer's administrator could list every other customer's private file
 * shares and their recipients.
 *
 * They are named here rather than left to a migration for the reason the list itself exists: a
 * migration writes the policy once, and `removeTenantIsolation` drops it again on any deployment that
 * runs without tenants. From this list it is restored on every boot.
 */
describe('private file delivery is tenant content', () => {
  const tables = [
    SystemConstants.TABLE.FILE_SHARES,
    SystemConstants.TABLE.FILE_GRANTS,
    SystemConstants.TABLE.FILE_ACCESS_LOG,
  ];

  it.each(tables)('%s is scoped', (table) => {
    expect(TenantScopedTables.isTenantScoped(table)).toBe(true);
  });

  it('stays scoped despite the `_system_` prefix that excludes configuration tables', () => {
    // The rule that made these global: anything `_system_*` is platform configuration unless named.
    for (const table of tables) expect(String(table).startsWith('_system_')).toBe(true);
    for (const table of tables) expect(TenantScopedTables.isTenantScoped(table)).toBe(true);
  });

  it('leaves genuine platform configuration alone', () => {
    // The counter-case, so this list cannot quietly grow into scoping identity or settings.
    expect(TenantScopedTables.isTenantScoped(SystemConstants.TABLE.USERS)).toBe(false);
    expect(TenantScopedTables.isTenantScoped(SystemConstants.TABLE.TENANTS)).toBe(false);
    expect(TenantScopedTables.isTenantScoped(SystemConstants.TABLE.PLUGINS)).toBe(false);
  });
});
