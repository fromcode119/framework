import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountRouteGuard } from '@/lib/account-route-guard';
import { ServerApiUtils } from '@/lib/server-api';
import { ServerFetchOutcome } from '@/lib/server-fetch-outcome';

/**
 * Guards the hole this class was written to close: `/account/email-preferences` (and every other
 * account path) answered 200 to a signed-out visitor, rendering the whole shell and every section
 * name. The client-side gate lived inside the framework's DEFAULT shell, so a theme registering its
 * own `account.shell` replaced the layout and took the authentication with it.
 *
 * These tests pin the two properties that matter: the guard covers exactly the account area, and it
 * fails CLOSED — "session unknown" must never resolve to "signed in" on a private surface.
 */
describe('AccountRouteGuard.covers', () => {
  it('covers the account index and its sections', () => {
    expect(AccountRouteGuard.covers('/account')).toBe(true);
    expect(AccountRouteGuard.covers('/account/')).toBe(true);
    expect(AccountRouteGuard.covers('/account/orders')).toBe(true);
    expect(AccountRouteGuard.covers('/account/email-preferences')).toBe(true);
    // The locale prefix is stripped before the guard is called, so the bare form is what it sees.
    expect(AccountRouteGuard.covers('account/orders')).toBe(true);
  });

  it('does not capture unrelated paths that merely start with the same letters', () => {
    expect(AccountRouteGuard.covers('/')).toBe(false);
    expect(AccountRouteGuard.covers('/accounts')).toBe(false);
    expect(AccountRouteGuard.covers('/accounting/invoices')).toBe(false);
    expect(AccountRouteGuard.covers('/shop/account-kit')).toBe(false);
    expect(AccountRouteGuard.covers('/login')).toBe(false);
  });
});

describe('AccountRouteGuard.enforce', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const probeReturning = (outcome: ServerFetchOutcome<Response>) =>
    vi.spyOn(ServerApiUtils, 'serverFetchResponseOutcome').mockResolvedValue(outcome as never);

  const jsonResponse = (status: number, body: unknown) =>
    ServerFetchOutcome.resolved<Response>({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as unknown as Response);

  it('is a no-op outside the account area, without even probing the session', async () => {
    const probe = probeReturning(jsonResponse(401, { error: 'Unauthorized' }));
    await expect(AccountRouteGuard.enforce('/shop', '/shop')).resolves.toBeUndefined();
    expect(probe).not.toHaveBeenCalled();
  });

  it('lets an authenticated visitor through', async () => {
    probeReturning(jsonResponse(200, { person: { id: 7, email: 'a@b.c' } }));
    await expect(
      AccountRouteGuard.enforce('/account/orders', '/account/orders'),
    ).resolves.toBeUndefined();
  });

  it('redirects a guest to login, returning them to the path they asked for', async () => {
    probeReturning(jsonResponse(401, { error: 'Unauthorized: missing or invalid token' }));
    await expect(
      AccountRouteGuard.enforce('/account/email-preferences', '/bg/account/email-preferences'),
    ).rejects.toThrow();
  });

  it('treats a 200 with no person as a guest — a status is not a session', async () => {
    probeReturning(jsonResponse(200, { person: null }));
    await expect(AccountRouteGuard.enforce('/account', '/account')).rejects.toThrow();
  });

  it('fails CLOSED when the API is unreachable', async () => {
    probeReturning(ServerFetchOutcome.unreachable<Response>(new Error('ECONNREFUSED')));
    await expect(AccountRouteGuard.enforce('/account', '/account')).rejects.toThrow();
  });
});
