import { BrowserStateClient, CookieConstants, LocalizationUtils } from '@fromcode119/core/client';
import bg from './i18n/bg.json';
import en from './i18n/en.json';

export class VerifyEmailCopyService {
  private static readonly browserState = new BrowserStateClient();

  static getCopy() {
    return VerifyEmailCopyService.getCatalog(VerifyEmailCopyService.getLocale());
  }

  private static getLocale(): string {
    if (typeof window === 'undefined') return 'en';
    try {
      const queryLocale = VerifyEmailCopyService.browserState.readQueryParamFromWindow('locale');
      const cookieLocale = VerifyEmailCopyService.browserState.readCookie(CookieConstants.LOCALE);
      return (
        LocalizationUtils.normalizeLocaleCode(queryLocale, { short: true }) ||
        LocalizationUtils.normalizeLocaleCode(cookieLocale, { short: true }) ||
        LocalizationUtils.normalizeLocaleCode(navigator.language, { short: true }) ||
        'en'
      );
    } catch {
      return 'en';
    }
  }

  private static getCatalog(locale: string) {
    const normalizedLocale = LocalizationUtils.normalizeLocaleCode(locale, { short: true }) || 'en';
    if (normalizedLocale === 'bg') {
      return { ...en, ...bg };
    }

    return en;
  }
}
