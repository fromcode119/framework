import { Request } from 'express';
import { CookieConstants, LocalizationUtils } from '@fromcode119/core';
import { RequestCookieService } from '@api/services/request/request-cookie-service';

export class RequestLocaleService {
  constructor(private readonly cookies: RequestCookieService = new RequestCookieService()) {}

  resolveRequestLocale(req: Request, fallbackLocale: string = 'en'): string {
    return this.explicitRequestLocale(req)
      || LocalizationUtils.normalizeLocaleCode(fallbackLocale)
      || 'en';
  }

  /** The locale the request itself names (`?locale`, then the locale cookie), or '' when it names none. */
  explicitRequestLocale(req: Request): string {
    return LocalizationUtils.normalizeLocaleCode(this.readQueryLocale(req))
      || LocalizationUtils.normalizeLocaleCode(this.cookies.readPrimaryCookieValue(req, CookieConstants.LOCALE))
      || '';
  }

  private readQueryLocale(req: Request): string {
    const queryValue = req.query?.locale;
    if (Array.isArray(queryValue)) {
      return String(queryValue[0] || '').trim();
    }

    return String(queryValue || '').trim();
  }
}