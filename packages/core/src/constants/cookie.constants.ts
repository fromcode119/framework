import { ClientRuntimeConstants } from '@core/constants/client-runtime.constants';

export class CookieConstants {
  static readonly AUTH_TOKEN = ClientRuntimeConstants.COOKIES.AUTH_TOKEN;
  static readonly AUTH_CSRF = ClientRuntimeConstants.COOKIES.AUTH_CSRF;
  static readonly AUTH_USER = ClientRuntimeConstants.COOKIES.AUTH_USER;
  static readonly LOCALE = ClientRuntimeConstants.COOKIES.LOCALE;
  static readonly CLIENT_AUTH_TOKEN = 'userToken' as const;
  static readonly ADMIN_EXPORT_AUTH_TOKEN = 'fromcode_token' as const;

  /**
   * A non-secret "there is a session" flag the BROWSER may read, holding no credential.
   *
   * The storefront login form used to write the JWT itself into a client cookie so the UI could tell
   * whether someone was signed in. That silently defeated the server's `httpOnly` on the SAME token:
   * the server's `userToken` is domain-scoped (`COOKIE_DOMAIN`) and the client's copy was host-only,
   * so the two coexisted and any script on the origin could read a 7-day session JWT and replay it
   * elsewhere. Verified live — `document.cookie` returned a 381-character token.
   *
   * The credential now lives ONLY in the server's `httpOnly` cookie, which the browser attaches on
   * its own (`credentials: 'include'`); this flag carries the signed-in state the UI actually needed.
   */
  static readonly CLIENT_SESSION_MARKER = CookieConstants.cookie('session');

  static readonly AUTH_COOKIES_TO_CLEAR = [
    CookieConstants.AUTH_TOKEN,
    CookieConstants.AUTH_USER,
    CookieConstants.AUTH_CSRF,
    CookieConstants.CLIENT_AUTH_TOKEN,
    CookieConstants.CLIENT_SESSION_MARKER,
    CookieConstants.ADMIN_EXPORT_AUTH_TOKEN,
  ] as const;

  /**
   * Build a platform-namespaced cookie name from a plugin-supplied suffix. The framework owns the `fc_`
   * prefix, so plugins pass only the semantic part (`cookie('consent_vid')` → `fc_consent_vid`) instead
   * of hardcoding the prefix.
   */
  static cookie(name: string): string {
    return `${ClientRuntimeConstants.STORAGE_PREFIX}${String(name).trim()}`;
  }
}
