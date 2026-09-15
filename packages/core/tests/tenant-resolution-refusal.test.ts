import { describe, expect, it } from 'vitest';
import { TenantResolutionRefusal } from '@core/tenant/tenant-resolution-refusal';

/**
 * The `value` of each member is the WIRE contract — it is what the API sends as `{ error }` and what
 * the admin switches on — so it is pinned here rather than left to be renamed by a refactor that
 * looks purely internal.
 *
 * `allowsUnauthenticatedSurface` decides whether a refused request still continues (with no tenant
 * bound) or is answered 403, so getting it wrong either locks operators out of the login or lets a
 * non-member past. Both directions are asserted for every member: a new refusal added without
 * deciding this shows up here as a failure, not as a production 403.
 */
describe('TenantResolutionRefusal', () => {
  it('keeps the wire values the clients read', () => {
    expect(TenantResolutionRefusal.UNAUTHENTICATED.value).toBe('unauthenticated');
    expect(TenantResolutionRefusal.NO_TENANT_SELECTED.value).toBe('no_tenant_selected');
    expect(TenantResolutionRefusal.TENANT_ACCESS_REVOKED.value).toBe('tenant_access_revoked');
    expect(TenantResolutionRefusal.UNKNOWN_TENANT.value).toBe('unknown_tenant');
  });

  it('serialises to its value, so `res.json({ error })` sends the string', () => {
    expect(JSON.stringify({ error: TenantResolutionRefusal.TENANT_ACCESS_REVOKED })).toBe('{"error":"tenant_access_revoked"}');
  });

  it('lets only the pre-tenant refusals through to the unauthenticated surface', () => {
    const allowed = TenantResolutionRefusal.values()
      .filter((refusal) => refusal.allowsUnauthenticatedSurface)
      .map((refusal) => refusal.value);
    expect(allowed).toEqual(['unauthenticated', 'no_tenant_selected', 'unknown_tenant']);
  });

  /**
   * Deleting the site you are currently in must not lock you out of the platform.
   *
   * The selected tenant lives in the session token, so every request after the delete names a tenant
   * that is gone. While this answered 403 the admin read it as a dead session and signed the operator
   * out — and signing back in did not help, because the site chooser needed the same refused surface
   * to offer anywhere else to go. One deleted site took the whole console down for the account that
   * deleted it.
   */
  it('does not treat a deleted site as a failure of authentication', () => {
    expect(TenantResolutionRefusal.UNKNOWN_TENANT.allowsUnauthenticatedSurface).toBe(true);
    // Still its own value: "the site you were in has been deleted" is worth saying, and is not the
    // same thing as never having chosen one.
    expect(TenantResolutionRefusal.UNKNOWN_TENANT).not.toBe(TenantResolutionRefusal.NO_TENANT_SELECTED);
    // And it is NOT revoked access — that one must keep answering 403.
    expect(TenantResolutionRefusal.UNKNOWN_TENANT.isAccessRevoked).toBe(false);
    expect(TenantResolutionRefusal.TENANT_ACCESS_REVOKED.allowsUnauthenticatedSurface).toBe(false);
  });

  it('names exactly one refusal as revoked access', () => {
    const revoked = TenantResolutionRefusal.values().filter((refusal) => refusal.isAccessRevoked);
    expect(revoked).toEqual([TenantResolutionRefusal.TENANT_ACCESS_REVOKED]);
  });

  it('resolves a member from its wire value and refuses an unknown one', () => {
    expect(TenantResolutionRefusal.fromValue('tenant_access_revoked')).toBe(TenantResolutionRefusal.TENANT_ACCESS_REVOKED);
    expect(TenantResolutionRefusal.fromValue('nope')).toBeUndefined();
  });
});
