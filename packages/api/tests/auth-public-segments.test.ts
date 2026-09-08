import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
// The constants module directly, not the package barrel: the barrel pulls PluginManager and with it
// the whole runtime, which this test has no use for and cannot resolve.
import { RouteConstants } from '@core/constants/route.constants';

/**
 * `RouteConstants.AUTH_PUBLIC_SEGMENTS` is what admin tenancy exempts from a `tenant_access_revoked`
 * refusal, so it must name EXACTLY the auth routes that carry no `auth.guard()`. Two ways for that to
 * go wrong, both silent:
 *
 *  - a guarded route creeps into the list → an authenticated-only endpoint is reachable with no tenant
 *    bound (its own guard still refuses it, but the exemption should never have been offered);
 *  - a new guardless route is added and NOT listed → on a workspace domain an account without a
 *    membership is answered 403 there, which is how `/auth/login` and `/auth/host` became unreachable
 *    for exactly the sessions that needed them.
 *
 * The router is read as TEXT rather than executed: registration needs a live controller, and the
 * question here is purely which registrations carry a guard.
 */
describe('auth public segments', () => {
  const source = readFileSync(join(__dirname, '..', 'src', 'routes', 'auth-router.ts'), 'utf8');

  /** `this.get(RouteConstants.SEGMENTS.X, ...)` → `['X', 'rest of the call']`. */
  const registrations = (): Array<{ name: string; guarded: boolean }> => {
    const pattern = /this\.(?:get|post|patch|put|delete)\(\s*RouteConstants\.SEGMENTS\.([A-Z0-9_]+)\s*,([^\n]*)/g;
    const found: Array<{ name: string; guarded: boolean }> = [];
    for (const match of source.matchAll(pattern)) {
      found.push({ name: match[1], guarded: match[2].includes('this.auth.guard(') });
    }
    return found;
  };

  const segmentPath = (name: string): string => (RouteConstants.SEGMENTS as Record<string, string>)[name];

  it('reads the router', () => {
    expect(registrations().length).toBeGreaterThan(20);
  });

  it('lists every guardless auth route', () => {
    const missing = registrations()
      .filter((route) => !route.guarded)
      .map((route) => segmentPath(route.name))
      .filter((path) => path && !RouteConstants.AUTH_PUBLIC_SEGMENTS.includes(path));
    expect(missing).toEqual([]);
  });

  it('lists no guarded auth route', () => {
    const guardedPaths = new Set(
      registrations().filter((route) => route.guarded).map((route) => segmentPath(route.name)),
    );
    const wrong = RouteConstants.AUTH_PUBLIC_SEGMENTS.filter((path) => guardedPaths.has(path));
    expect(wrong).toEqual([]);
  });
});
