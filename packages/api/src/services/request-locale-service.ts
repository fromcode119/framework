import { Request } from 'express';
import { CookieConstants, LocalizationUtils } from '@fromcode119/core';
import { RequestCookieService } from './request-cookie-service';

export class RequestLocaleService {
  constructor(private readonly cookies: RequestCookieService = new RequestCookieService()) {}

  resolveRequestLocale(req: Request, fallbackLocale: string = 'en'): string {
    const queryLocale = this.readQueryLocale(req);
    const cookieLocale = this.cookies.readPrimaryCookieValue(req, CookieConstants.LOCALE);

    return (
      LocalizationUtils.normalizeLocaleCode(queryLocale)
      || LocalizationUtils.normalizeLocaleCode(cookieLocale)
      || LocalizationUtils.normalizeLocaleCode(fallbackLocale)
      || 'en'
    );
  }

  private readQueryLocale(req: Request): string {
    const queryValue = req.query?.locale;
    if (Array.isArray(queryValue)) {
      return String(queryValue[0] || '').trim();
    }

    return String(queryValue || '').trim();
  }
}
