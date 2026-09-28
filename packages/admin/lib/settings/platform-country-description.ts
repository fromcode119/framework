import { PlatformCountrySource } from '@fromcode119/core/client';
import type { IPlatformCountry } from '@fromcode119/core/client';
import { CountryCatalog } from '@/components/collection/fields/country-catalog';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * One sentence saying which platform country is in effect and WHY — shared by Settings → Localization
 * and every module field that inherits it, so both screens name the same value the same way.
 */
export class PlatformCountryDescription {
  static describe(resolved: IPlatformCountry): string {
    const label = CountryCatalog.labelFor(resolved.country);
    if (resolved.source === PlatformCountrySource.SETTING) return label;
    if (resolved.source === PlatformCountrySource.LANGUAGE) {
      return AdminI18n.t('lib.derivedFromTheFrontendLanguage', { label: label, language: resolved.language });
    }
    return AdminI18n.t('lib.noneNoCountryIsSet');
  }
}
