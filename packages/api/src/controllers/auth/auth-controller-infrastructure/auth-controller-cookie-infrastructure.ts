import { Request, Response } from 'express';
import { CookieConstants } from '@fromcode119/core';
import { ApiUrlUtils } from '../../../utils/url';
import { AuthControllerEmailInfrastructure } from './auth-controller-email-infrastructure';

export class AuthControllerCookieInfrastructure extends AuthControllerEmailInfrastructure {
  protected clearAuthCookies(req: Request, res: Response) {
    const cookieOptions = this.getCookieOptions(req, true);
    this.clearCookieVariants(res, CookieConstants.AUTH_TOKEN, cookieOptions, false);
    this.clearCookieVariants(res, CookieConstants.CLIENT_AUTH_TOKEN, cookieOptions, false);
    this.clearCookieVariants(res, CookieConstants.AUTH_CSRF, cookieOptions, false);
    this.clearCookieVariants(res, CookieConstants.AUTH_USER, cookieOptions, false);
    this.clearCookieVariants(res, CookieConstants.ADMIN_EXPORT_AUTH_TOKEN, cookieOptions, false);
  }

  protected clearConflictingSessionCookies(req: Request, res: Response) {
    const cookieOptions = this.getCookieOptions(req, true);

    if (this.isAdminRequestContext(req)) {
      this.clearCookieVariants(res, CookieConstants.CLIENT_AUTH_TOKEN, cookieOptions, false);
      return;
    }

    this.clearCookieVariants(res, CookieConstants.AUTH_TOKEN, cookieOptions, false);
    this.clearCookieVariants(res, CookieConstants.AUTH_USER, cookieOptions, false);
    this.clearCookieVariants(res, CookieConstants.ADMIN_EXPORT_AUTH_TOKEN, cookieOptions, false);
  }

  protected clearCookieVariants(res: Response, name: string, cookieOptions: Record<string, any>, httpOnly: boolean) {
    res.clearCookie(name, { ...cookieOptions, httpOnly });
    const hostOptions = { ...cookieOptions } as any;
    delete hostOptions.domain;
    res.clearCookie(name, { ...hostOptions, httpOnly });
  }

  protected getCookieOptions(req: Request, isLogout = false, maxAgeMs?: number) {
    const isProd = process.env.NODE_ENV === 'production';
    const secure = isProd && ApiUrlUtils.isHttps(req);

    const options: any = {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
    };

    if (!isLogout) {
      options.maxAge = maxAgeMs || this.defaultSessionDurationMinutes * 60 * 1000;
    }

    const domain = process.env.COOKIE_DOMAIN || ApiUrlUtils.getCookieDomain(req);
    if (domain) {
      options.domain = domain;
    }

    return options;
  }
}
