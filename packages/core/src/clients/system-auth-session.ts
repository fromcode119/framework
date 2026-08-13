import { CookieConstants } from '@core/constants/cookie.constants';
import { BrowserStateClient } from '@core/clients/browser-state-client';
import { EnvUtils } from '@core/utils/env-utils';

export class SystemAuthSession {
  private static readonly USER_CACHE_KEY = 'userData' as const;
  private static readonly AUTH_STATE_EVENT = 'authStateChanged' as const;
  private static readonly CLIENT_TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
  private readonly browserState = new BrowserStateClient();

  constructor() {
    this.migrateLegacyClientToken();
  }

  /**
   * Retires a client-written token cookie left in a browser by the previous scheme.
   *
   * Two things would otherwise break for anyone already signed in when this shipped: their session
   * carries no marker, so the UI would read them as signed OUT while their `httpOnly` cookie is still
   * perfectly valid; and the readable JWT would sit in their browser until it expired, up to seven
   * days of the exact exposure this change removes. Swapping one for the other on first construction
   * fixes both at once, and does nothing for a browser that never had the legacy cookie.
   */
  private migrateLegacyClientToken(): void {
    if (EnvUtils.isServer()) return;
    if (!this.browserState.readCookie(CookieConstants.CLIENT_AUTH_TOKEN)) return;

    this.browserState.writeCookie(
      CookieConstants.CLIENT_SESSION_MARKER,
      '1',
      { maxAgeSeconds: SystemAuthSession.CLIENT_TOKEN_MAX_AGE_SECONDS },
    );
    // Host-only, exactly as it was written — the server's domain-scoped httpOnly cookie is a
    // DIFFERENT entry and is untouched, so the session itself survives this.
    this.browserState.clearCookie(CookieConstants.CLIENT_AUTH_TOKEN);
  }

  /**
   * There is NO `getStoredToken()`. The session JWT is deliberately unreadable from the browser — it
   * lives only in the server's `httpOnly` cookie, which travels on its own with `credentials:
   * 'include'`. A method promising the token would either have to lie or re-expose it.
   */
  hasStoredSession(): boolean {
    return Boolean(this.browserState.readCookie(CookieConstants.CLIENT_SESSION_MARKER));
  }

  /**
   * Records that a session EXISTS plus the cached user for UI. Takes no token: the credential is the
   * server's `httpOnly` cookie, set by the login response, and the browser attaches it unaided.
   */
  storeSession(user: any): void {
    this.browserState.writeCookie(
      CookieConstants.CLIENT_SESSION_MARKER,
      '1',
      { maxAgeSeconds: SystemAuthSession.CLIENT_TOKEN_MAX_AGE_SECONDS },
    );

    if (EnvUtils.isServer()) {
      return;
    }

    this.browserState.writeLocalJson(SystemAuthSession.USER_CACHE_KEY, user || {});
    this.dispatchAuthStateChanged();
  }

  clearSession(): void {
    this.browserState.clearCookie(CookieConstants.CLIENT_SESSION_MARKER);
    // Also clear the legacy client-written token copy, so a browser carrying one from before this
    // change stops exposing a live JWT to scripts the moment the user signs out.
    this.browserState.clearCookie(CookieConstants.CLIENT_AUTH_TOKEN);

    if (EnvUtils.isServer()) {
      return;
    }

    this.browserState.removeLocalValue(SystemAuthSession.USER_CACHE_KEY);
    this.dispatchAuthStateChanged();
  }

  readStoredUser(): any | null {
    if (EnvUtils.isServer()) {
      return null;
    }

    const rawUser = this.browserState.readLocalJson<any | null>(SystemAuthSession.USER_CACHE_KEY, null);
    if (!this.hasStoredSession() || !rawUser) {
      return null;
    }

    try {
      return rawUser;
    } catch {
      this.clearSession();
      return null;
    }
  }

  mergeStoredUser(user: any): void {
    if (EnvUtils.isServer()) {
      return;
    }

    const current = this.readStoredUser() || {};
    this.browserState.writeLocalJson(SystemAuthSession.USER_CACHE_KEY, { ...current, ...(user || {}) });
    this.dispatchAuthStateChanged();
  }

  private dispatchAuthStateChanged(): void {
    if (EnvUtils.isServer()) {
      return;
    }

    window.dispatchEvent(new CustomEvent(SystemAuthSession.AUTH_STATE_EVENT));
  }
}
