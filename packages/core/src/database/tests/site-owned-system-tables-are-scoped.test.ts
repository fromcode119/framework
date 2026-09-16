import { describe, expect, it } from 'vitest';
import { SystemConstants } from '@core/constants/system.constants';
import { TenantBespokePolicies } from '@core/database/tenant-bespoke-policies';
import { TenantScopedTables } from '@core/database/tenant-scoped-tables';

/**
 * The remaining `_system_*` tables that hold one site's own information.
 *
 * Found by asking the database which tables have no policy rather than by reading the code, which is
 * how the earlier passes missed them: a table with no `tenant_id` column looks like configuration and
 * is silently readable by everyone.
 *
 *   notifications        — the in-app inbox. Recipient resolution was scoped when `notifyAdmins`
 *                          stopped answering globally; the table never was, and has no tenant column
 *                          at all. Measured: one operator in four sites holding 141 rows, including a
 *                          certificate warning naming another customer's domain, shown in every scope.
 *                          It is a JOURNAL, not a generically scoped table — see below.
 *   site_preview_grants  — access to a site's unpublished content. Had the column, never the policy.
 *
 * Named here rather than in a migration for the reason the list exists: a migration writes the policy
 * once, and `removeTenantIsolation` drops it again on any deployment that runs without tenants.
 */
describe('site-owned system tables are tenant content', () => {
  const tables = [
    SystemConstants.TABLE.SITE_PREVIEW_GRANTS,
  ];

  it.each(tables)('%s is scoped', (table) => {
    expect(TenantScopedTables.isTenantScoped(table)).toBe(true);
  });

  it('stays scoped despite the `_system_` prefix that excludes configuration tables', () => {
    for (const table of tables) expect(String(table).startsWith('_system_')).toBe(true);
    for (const table of tables) expect(TenantScopedTables.isTenantScoped(table)).toBe(true);
  });

  /**
   * The inbox is scoped, but NOT by the generic predicate.
   *
   * The generic predicate is strict equality, so a row whose `tenant_id` is NULL matches in no scope
   * at all — `TenantAdoptionService` states the invariant as "one NULL row is a row that becomes
   * invisible to everyone". This table is written from both sides: inside a site when a plugin
   * notifies its admins, and with no tenant bound by the certificate sweep and the boot health
   * reporter. Scoping it generically would have hidden every notification the untenanted half ever
   * wrote, on every existing deployment, silently. The journal predicate says what is wanted: a site
   * sees its own, and untenanted rows belong to the platform scope.
   */
  it('scopes the inbox as a journal, so untenanted rows stay readable in the platform scope', () => {
    expect(TenantBespokePolicies.tables()).toContain(SystemConstants.TABLE.NOTIFICATIONS);
    expect(TenantBespokePolicies.specs().find((s) => s.table === SystemConstants.TABLE.NOTIFICATIONS)?.kind)
      .toBe('journal');
    // The generic sweep must skip exactly the bespoke tables, so it must NOT also claim this one.
    expect(TenantScopedTables.isTenantScoped(SystemConstants.TABLE.NOTIFICATIONS)).toBe(false);
  });

  /**
   * The deliberate exclusions, asserted so a later sweep cannot "finish the job" by scoping them.
   *
   * A SESSION must be readable before a tenant is bound — that read is what establishes who is asking
   * and therefore which site they may enter, so a policy on it would close the door it holds open. It
   * has a `tenant_id` column, which is exactly why it needs saying. The tenancy registry is the map
   * answering which sites an account may enter, so it cannot be behind that same answer.
   */
  it('does not scope the tables that answer who may enter which site', () => {
    expect(TenantScopedTables.isTenantScoped(SystemConstants.TABLE.SESSIONS)).toBe(false);
    expect(TenantScopedTables.isTenantScoped(SystemConstants.TABLE.TENANTS)).toBe(false);
    expect(TenantScopedTables.isTenantScoped(SystemConstants.TABLE.TENANT_MEMBERSHIPS)).toBe(false);
    expect(TenantScopedTables.isTenantScoped(SystemConstants.TABLE.USERS)).toBe(false);
  });
});
