import { LocalizationUtils } from '@fromcode119/core/client';
import bg from '@/app/verify-email/i18n/bg.json';
import en from '@/app/verify-email/i18n/en.json';

export class VerifyEmailCopyService {
  static getCopy(locale?: string) {
    return VerifyEmailCopyService.getCatalog(locale || 'en');
  }

  private static getCatalog(locale: string) {
    const normalizedLocale = LocalizationUtils.normalizeLocaleCode(locale, { short: true }) || 'en';
    if (normalizedLocale === 'bg') {
      return { ...en, ...bg };
    }

    return en;
  }
}
