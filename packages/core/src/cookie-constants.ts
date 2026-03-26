import { ClientRuntimeConstants } from './client-runtime-constants';

export class CookieConstants {
  static readonly AUTH_TOKEN = ClientRuntimeConstants.COOKIES.AUTH_TOKEN;
  static readonly AUTH_CSRF = ClientRuntimeConstants.COOKIES.AUTH_CSRF;
  static readonly AUTH_USER = ClientRuntimeConstants.COOKIES.AUTH_USER;
  static readonly LOCALE = ClientRuntimeConstants.COOKIES.LOCALE;
  static readonly CLIENT_AUTH_TOKEN = 'userToken' as const;
  static readonly ADMIN_EXPORT_AUTH_TOKEN = 'fromcode_token' as const;
  static readonly LEGACY_AUTH_TOKENS = ClientRuntimeConstants.COOKIES.LEGACY_AUTH_TOKENS;
  static readonly AUTH_COOKIES_TO_CLEAR = [
    CookieConstants.AUTH_TOKEN,
    CookieConstants.AUTH_USER,
    CookieConstants.AUTH_CSRF,
    CookieConstants.CLIENT_AUTH_TOKEN,
    CookieConstants.ADMIN_EXPORT_AUTH_TOKEN,
    ...CookieConstants.LEGACY_AUTH_TOKENS,
  ] as const;
}
