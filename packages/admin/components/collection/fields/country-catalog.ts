import { ISystemLocaleOption } from '@/components/collection/fields/interfaces/system-locale-option.interface';
import { CountryCodes } from '@fromcode119/core/client';
import { TimezoneUtils } from '@/lib/timezone';

/**
 * Complete ISO 3166-1 country catalog. The CODES are the framework's {@link CountryCodes}. Their NAMES
 * come from `Intl.DisplayNames` in the console's language, so a Bulgarian console lists "България", not "Bulgaria", and sorts in that
 * language. Consumed by {@link CountryField}; reusable by any plugin via `admin.component:'CountryField'`.
 */
export class CountryCatalog {
  static readonly CODES: readonly string[] = CountryCodes.ALL;

  /** Every country as a select option, named and sorted in the console's language. */
  static options(): ISystemLocaleOption[] {
    const locale = TimezoneUtils.resolveSystemLocale();
    return CountryCatalog.CODES
      .map((code) => ({ value: code, label: CountryCatalog.nameOf(code, locale) }))
      .sort((left, right) => left.label.localeCompare(right.label, locale));
  }

  /** "България (BG)" for a known code, the bare code otherwise, '' for none. */
  static labelFor(code: string): string {
    if (!code) return '';
    if (!CountryCatalog.CODES.includes(code)) return code;
    return `${CountryCatalog.nameOf(code, TimezoneUtils.resolveSystemLocale())} (${code})`;
  }

  private static nameOf(code: string, locale: string): string {
    try {
      return new Intl.DisplayNames([locale], { type: 'region' }).of(code) || code;
    } catch {
      return code;
    }
  }
}
