import { describe, expect, it, vi } from 'vitest';
import { RequestSurfaceUtils } from '@core/request-surface-utils';

/**
 * An admin console's session cookie must be HOST-scoped, and a storefront's must not be.
 *
 * The bug this pins: one `fc_token` under `COOKIE_DOMAIN` was shared by every console on the domain,
 * while the token inside it carries a single `tenantId` claim that each workspace host re-mints for
 * itself. Opening a second workspace therefore invalidated the first — "Token tenant mismatch: minted
 * for hub, presented to nexora" — and the client purged the session. The same shared cookie is what let
 * a readable user cookie paint a signed-in console on a domain the account had no membership on.
 *
 * The storefront keeps the apex domain on purpose: a customer session is read by the frontend host for
 * SSR and by the api host for its own calls, and those are different hosts by design.
 */
describe('admin session cookie scope', () => {
  const req = (headers: Record<string, string>) => ({
    headers,
    get: (name: string) => headers[name.toLowerCase()],
    hostname: 'admin.example.test',
    path: '/api/v1/auth/login',
    originalUrl: '/api/v1/auth/login',
    url: '/api/v1/auth/login',
  }) as any;

  it('recognises an admin console request', () => {
    expect(RequestSurfaceUtils.isAdminRequestContext(req({ 'x-framework-client': 'admin-ui' }))).toBe(true);
  });

  it('does not treat a storefront request as an admin console', () => {
    expect(RequestSurfaceUtils.isAdminRequestContext(req({ 'x-framework-client': 'frontend-ui' }))).toBe(false);
  });

  it('omits the domain for an admin console and keeps it for the storefront', async () => {
    vi.stubEnv('COOKIE_DOMAIN', '.example.test');
    const { AuthControllerCookieInfrastructure } = await import(
      '@api/controllers/auth/auth-controller-infrastructure/auth-controller-cookie-infrastructure'
    );
    // `getCookieOptions` is protected: this suite is the caller that proves the scope, so it reaches it
    // the way a subclass would rather than restating the rule it is meant to be checking.
    const options = (r: unknown) =>
      (AuthControllerCookieInfrastructure.prototype as unknown as {
        getCookieOptions: (req: unknown, isLogout?: boolean) => Record<string, unknown>;
      }).getCookieOptions.call({ defaultSessionDurationMinutes: 60 }, r);

    expect(options(req({ 'x-framework-client': 'admin-ui' })).domain).toBeUndefined();
    expect(options(req({ 'x-framework-client': 'frontend-ui' })).domain).toBe('.example.test');
    vi.unstubAllEnvs();
    // The dynamic import pulls the whole `@fromcode119/core` barrel — around 1,400 modules — which
    // takes 13-14 seconds to transform from cold and cannot fit the 5s default. It passed for a long
    // time only because some earlier file in the same worker had already imported the barrel, so this
    // was a cache hit; the moment file order changed it began timing out, which is a property of the
    // suite and not of the code under test.
  }, 60_000);
});
