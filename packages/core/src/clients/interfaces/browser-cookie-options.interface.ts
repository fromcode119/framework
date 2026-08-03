import { CookieSameSite } from '@core/clients/enums/cookie-same-site.enum';

export interface IBrowserCookieOptions {
  domain?: string;
  maxAgeSeconds?: number;
  path?: string;
  sameSite?: CookieSameSite;
  secure?: boolean;
}
