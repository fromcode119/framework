import { ClientRuntimeConstants } from './client-runtime-constants';

export class CookieConstants {
  static readonly AUTH_TOKEN = ClientRuntimeConstants.COOKIES.AUTH_TOKEN;
  static readonly AUTH_CSRF = ClientRuntimeConstants.COOKIES.AUTH_CSRF;
  static readonly AUTH_USER = ClientRuntimeConstants.COOKIES.AUTH_USER;
  static readonly LOCALE = ClientRuntimeConstants.COOKIES.LOCALE;
  static readonly CLIENT_AUTH_TOKEN = 'userToken' as const;
  static readonly ADMIN_EXPORT_AUTH_TOKEN = 'fromcode_token' as const;
  static readonly AUTH_COOKIES_TO_CLEAR = [
    CookieConstants.AUTH_TOKEN,
    CookieConstants.AUTH_USER,
    CookieConstants.AUTH_CSRF,
    CookieConstants.CLIENT_AUTH_TOKEN,
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
