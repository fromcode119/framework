import { SystemConstants } from '@fromcode119/core/client';

/**
 * Every setting the Security screen owns, in one list.
 *
 * The page reads this list to build its form and writes the same list back, so a control can never
 * exist without its value being loaded, and a value can never be loaded and then dropped on save —
 * the shape of failure that made "Update Security" report success while never sending the key.
 *
 * Each key is also in the API's `WRITABLE_SETTINGS_KEYS`
 * (`packages/api/src/controllers/system/system-admin-controller.ts`); anything missing there comes
 * back as a 400 naming the key rather than being silently dropped.
 */
export class SecuritySettingsKeys {
  static readonly ALL: readonly string[] = [
    SystemConstants.META_KEY.TWO_FACTOR_ENABLED,
    SystemConstants.META_KEY.AUTH_SESSION_DURATION,
    SystemConstants.META_KEY.AUTH_SECURITY_NOTIFICATIONS,
    SystemConstants.META_KEY.RATE_LIMIT_MAX,
    SystemConstants.META_KEY.RATE_LIMIT_MAX_AUTHENTICATED,
    SystemConstants.META_KEY.RATE_LIMIT_MAX_INTERNAL,
    SystemConstants.META_KEY.RATE_LIMIT_INTERNAL_CLIENTS,
    SystemConstants.META_KEY.RATE_LIMIT_WINDOW,
    SystemConstants.META_KEY.AUTH_PASSWORD_MIN_LENGTH,
    SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_UPPERCASE,
    SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_LOWERCASE,
    SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_NUMBER,
    SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_SYMBOL,
    SystemConstants.META_KEY.AUTH_PASSWORD_HISTORY,
    SystemConstants.META_KEY.AUTH_PASSWORD_BREACH_CHECK,
    SystemConstants.META_KEY.AUTH_LOCKOUT_THRESHOLD,
    SystemConstants.META_KEY.AUTH_LOCKOUT_WINDOW_MINUTES,
    SystemConstants.META_KEY.AUTH_LOCKOUT_DURATION_MINUTES,
    SystemConstants.META_KEY.AUTH_CAPTCHA_ENABLED,
    SystemConstants.META_KEY.AUTH_CAPTCHA_THRESHOLD,
    SystemConstants.META_KEY.AUTH_PASSWORD_RESET_TOKEN_MINUTES,
    SystemConstants.META_KEY.AUTH_EMAIL_CHANGE_TOKEN_MINUTES,
  ];
}
