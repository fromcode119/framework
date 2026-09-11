import { describe, expect, it } from 'vitest';
import { CookieConstants } from '@core/constants/cookie.constants';

/**
 * The CSRF token must OUTLIVE the session it protects.
 *
 * It is one half of a double-submit pair — a random value that grants nothing on its own — and every
 * POST that matters while signed OUT needs it: login, password reset, and a fresh installation's
 * `auth/setup`. It used to be cleared alongside the credentials, so the same response that minted a
 * token also expired it; `auth/setup` then answered 403 "Invalid CSRF token" on the first attempt and
 * succeeded on a later one, purely by which response reached the browser last.
 */
describe('signed-out cookie clearing', () => {
  it('clears the credentials', () => {
    expect(CookieConstants.AUTH_COOKIES_TO_CLEAR).toContain(CookieConstants.AUTH_TOKEN);
    expect(CookieConstants.AUTH_COOKIES_TO_CLEAR).toContain(CookieConstants.CLIENT_AUTH_TOKEN);
    expect(CookieConstants.AUTH_COOKIES_TO_CLEAR).toContain(CookieConstants.AUTH_USER);
  });

  it('does NOT clear the CSRF token, which the next signed-out POST depends on', () => {
    expect(CookieConstants.AUTH_COOKIES_TO_CLEAR).not.toContain(CookieConstants.AUTH_CSRF);
  });
});
