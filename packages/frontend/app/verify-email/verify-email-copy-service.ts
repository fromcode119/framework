import { LocalizationUtils } from '@fromcode119/core/client';
import bg from '@/app/verify-email/i18n/bg.json';
import en from '@/app/verify-email/i18n/en.json';

export class VerifyEmailCopyService {
  static getCopy(locale?: string) {
    return VerifyEmailCopyService.getCatalog(locale || 'en');
  }

  /** One entry per `./i18n/<locale>.json`; a language is added by adding its file here, not a branch. */
  private static readonly CATALOGS: Record<string, Partial<typeof en>> = { en, bg };

  private static getCatalog(locale: string) {
    const normalizedLocale = LocalizationUtils.normalizeLocaleCode(locale, { short: true }) || 'en';
    return { ...en, ...(VerifyEmailCopyService.CATALOGS[normalizedLocale] ?? {}) };
  }
}
