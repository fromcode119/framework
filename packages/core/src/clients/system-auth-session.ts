import { CookieConstants } from '@core/constants/cookie.constants';
import { BrowserStateClient } from '@core/clients/browser-state-client';
import { EnvUtils } from '@core/utils/env-utils';

export class SystemAuthSession {
  private static readonly USER_CACHE_KEY = 'userData' as const;
  private static readonly AUTH_STATE_EVENT = 'authStateChanged' as const;
  private static readonly CLIENT_TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
  private readonly browserState = new BrowserStateClient();

  getStoredToken(): string {
    return this.browserState.readCookie(CookieConstants.CLIENT_AUTH_TOKEN);
  }

  hasStoredSession(): boolean {
    return Boolean(this.getStoredToken());
  }

  storeSession(token: string, user: any): void {
    const normalizedToken = String(token || '').trim();
    if (normalizedToken) {
      this.browserState.writeCookie(
        CookieConstants.CLIENT_AUTH_TOKEN,
        normalizedToken,
        { maxAgeSeconds: SystemAuthSession.CLIENT_TOKEN_MAX_AGE_SECONDS },
      );
    }

    if (EnvUtils.isServer()) {
      return;
    }

    this.browserState.writeLocalJson(SystemAuthSession.USER_CACHE_KEY, user || {});
    this.dispatchAuthStateChanged();
  }

  clearSession(): void {
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

    const token = this.getStoredToken();
    const rawUser = this.browserState.readLocalJson<any | null>(SystemAuthSession.USER_CACHE_KEY, null);
    if (!token || !rawUser) {
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

  buildAuthorizationHeaders(headers?: Record<string, any>): Record<string, any> {
    const nextHeaders: Record<string, any> = { ...(headers || {}) };
    const token = this.getStoredToken();
    if (token && !nextHeaders.Authorization) {
      nextHeaders.Authorization = `Bearer ${token}`;
    }

    return nextHeaders;
  }

  private dispatchAuthStateChanged(): void {
    if (EnvUtils.isServer()) {
      return;
    }

    window.dispatchEvent(new CustomEvent(SystemAuthSession.AUTH_STATE_EVENT));
  }
}
