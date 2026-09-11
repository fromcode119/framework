import { CoercionUtils, SystemConstants } from '@fromcode119/core';

/**
 * The platform choices the first-run wizard collects alongside the administrator account.
 *
 * Every one is OPTIONAL and only written when the wizard actually sent it: an install that skips a
 * step must not end up with a language, a name or a timezone nobody chose. Each maps to a key
 * Settings already owns and displays, so the wizard is a shortcut to those screens, never a second
 * place a value can come from.
 */
export class InitialSetupPreferences {
  /** A BCP 47 tag as we accept them elsewhere: `bg`, `en`, `pt-BR`. */
  private static readonly LOCALE_PATTERN = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i;

  private static readonly MAX_PLATFORM_NAME_LENGTH = 120;

  private constructor(private readonly values: Map<string, string>) {}

  static fromRequestBody(body: Record<string, unknown> | undefined): InitialSetupPreferences {
    const values = new Map<string, string>();

    const locale = InitialSetupPreferences.readLocale(body?.locale);
    if (locale) values.set(SystemConstants.META_KEY.ADMIN_DEFAULT_LOCALE, locale);

    const platformName = InitialSetupPreferences.readPlatformName(body?.platformName);
    if (platformName) values.set(SystemConstants.META_KEY.PLATFORM_NAME, platformName);

    const timezone = InitialSetupPreferences.readTimezone(body?.timezone);
    if (timezone) values.set(SystemConstants.META_KEY.TIMEZONE, timezone);

    return new InitialSetupPreferences(values);
  }

  get entries(): Array<[string, string]> {
    return Array.from(this.values.entries());
  }

  private static readLocale(value: unknown): string {
    const locale = CoercionUtils.toString(value).trim();
    return InitialSetupPreferences.LOCALE_PATTERN.test(locale) ? locale.toLowerCase() : '';
  }

  private static readPlatformName(value: unknown): string {
    return CoercionUtils.toString(value).trim().slice(0, InitialSetupPreferences.MAX_PLATFORM_NAME_LENGTH);
  }

  /**
   * Checked against the runtime's own IANA database rather than a list we would have to maintain:
   * `DateTimeFormat` throws on a zone it does not know, which is the only authority that matters for
   * a value every later date format is resolved against.
   */
  private static readTimezone(value: unknown): string {
    const timezone = CoercionUtils.toString(value).trim();
    if (!timezone) return '';
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone });
      return timezone;
    } catch {
      return '';
    }
  }
}
