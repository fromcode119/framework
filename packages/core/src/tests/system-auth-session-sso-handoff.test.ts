// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { CookieConstants } from '@core/constants/cookie.constants';
import { SystemAuthSession } from '@core/clients/system-auth-session';

/**
 * A social sign-in ends in a redirect, so no login response reaches the page to store the user from.
 * The server leaves the summary in a short-lived cookie and the session store adopts it on whatever page
 * the visitor lands, which is what makes the sign-in visible in every theme — not just the framework's form.
 */
const handoff = (user: unknown) => Buffer.from(JSON.stringify(user)).toString('base64url');

afterEach(() => {
  for (const name of [CookieConstants.SSO_HANDOFF, CookieConstants.CLIENT_SESSION_MARKER]) {
    document.cookie = `${name}=; path=/; max-age=0`;
  }
  localStorage.clear();
});

describe('SystemAuthSession SSO handoff', () => {
  it('records the signed-in user once and deletes the handoff', () => {
    document.cookie = `${CookieConstants.SSO_HANDOFF}=${handoff({ id: '7', email: 'ana@example.com', firstName: 'Ана' })}; path=/`;
    const session = new SystemAuthSession();

    expect(session.hasStoredSession()).toBe(true);
    expect(session.readStoredUser()).toEqual({ id: '7', email: 'ana@example.com', firstName: 'Ана' });
    expect(document.cookie).not.toContain(`${CookieConstants.SSO_HANDOFF}=`);
  });

  it('ignores a malformed handoff and signs nobody in', () => {
    document.cookie = `${CookieConstants.SSO_HANDOFF}=not-base64-json; path=/`;
    const session = new SystemAuthSession();
    expect(session.hasStoredSession()).toBe(false);
  });

  it('does nothing when there is no handoff', () => {
    expect(new SystemAuthSession().hasStoredSession()).toBe(false);
  });
});
