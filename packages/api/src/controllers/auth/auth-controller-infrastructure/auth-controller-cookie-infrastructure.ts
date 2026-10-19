import { Request, Response } from 'express';
import { CookieConstants, RequestSurfaceUtils } from '@fromcode119/core';
import { ApiUrlUtils } from '@api/utils/url';
import { AuthControllerEmailInfrastructure } from '@api/controllers/auth/auth-controller-infrastructure/auth-controller-email-infrastructure';

export class AuthControllerCookieInfrastructure extends AuthControllerEmailInfrastructure {
  protected clearAuthCookies(req: Request, res: Response) {
    const cookieOptions = this.getCookieOptions(req, true);
    // The scope admin cookies USED to be written with, so a session issued before host-scoping is
    // actually removed rather than left to shadow the new one.
    const legacyDomain = ApiUrlUtils.getCookieDomain(req);
    this.clearCookieVariants(res, CookieConstants.AUTH_TOKEN, cookieOptions, false, legacyDomain);
    this.clearCookieVariants(res, CookieConstants.CLIENT_AUTH_TOKEN, cookieOptions, false, legacyDomain);
    this.clearCookieVariants(res, CookieConstants.CLIENT_SESSION_MARKER, cookieOptions, false, legacyDomain);
    // NOT the CSRF token: it grants nothing by itself and is required while signed OUT, so clearing
    // it here expired the token CSRFMiddleware had just set on this very response and made the next
    // POST — a login, or a fresh install's setup — fail with 403.
    this.clearCookieVariants(res, CookieConstants.AUTH_USER, cookieOptions, false, legacyDomain);
    this.clearCookieVariants(res, CookieConstants.ADMIN_EXPORT_AUTH_TOKEN, cookieOptions, false, legacyDomain);
  }

  /**
   * Sets a session cookie and, for a STOREFRONT session, the readable "there is a session" marker in
   * the SAME scope.
   *
   * The credential is domain-wide (`COOKIE_DOMAIN`) so every host of the site is signed in, but the
   * marker used to be written only by the browser, host-only, on the page the sign-in finished on. A
   * site served on both its apex and `www` then had one host that knew it was signed in and one whose
   * UI read the visitor as signed OUT while the server still accepted their cookie — an emailed sign-in
   * link landing on the apex left `www` asking for the email again. The marker holds no credential.
   */
  protected writeSessionCookie(res: Response, name: string, token: string, cookieOptions: Record<string, any>) {
    res.cookie(name, token, cookieOptions);
    if (name === CookieConstants.CLIENT_AUTH_TOKEN) {
      res.cookie(CookieConstants.CLIENT_SESSION_MARKER, '1', { ...cookieOptions, httpOnly: false });
    }
  }

  /**
   * CLEARING is deliberately wider than setting.
   *
   * A cookie is only removed by a `Set-Cookie` whose scope matches the one it was written with, and an
   * admin session is now written host-scoped while it used to be written to the apex. Clearing only the
   * host variant would leave that older domain-wide cookie in the browser, still sent on every request
   * to every console — shadowing the new one and reviving the very bug this change removes. So logout
   * clears the host variant AND the apex variant, whatever the current surface writes.
   */
  protected clearCookieVariants(res: Response, name: string, cookieOptions: Record<string, any>, httpOnly: boolean, legacyDomain?: string) {
    res.clearCookie(name, { ...cookieOptions, httpOnly });
    const hostOptions = { ...cookieOptions } as any;
    delete hostOptions.domain;
    res.clearCookie(name, { ...hostOptions, httpOnly });
    if (legacyDomain && legacyDomain !== cookieOptions.domain) {
      res.clearCookie(name, { ...hostOptions, domain: legacyDomain, httpOnly });
    }
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

    // An ADMIN console's session is HOST-scoped: no Domain, so the cookie belongs to the one host that
    // issued it. Every console — the shared admin and each workspace domain — proxies its API calls
    // through its own origin, so this genuinely gives each one its own session.
    //
    // Domain-scoping them was a real fault, not a preference. One `fc_token` under `COOKIE_DOMAIN`
    // was shared by every console, while the token inside it carries a single `tenantId` claim that
    // each workspace host re-mints for itself — so opening a second workspace silently invalidated the
    // first ("Token tenant mismatch: minted for X, presented to Y") and the client purged the session.
    // The same shared cookie is what let the readable user cookie paint a signed-in console on a
    // domain the account had no membership on. Host-scoped, a token minted for one console cannot
    // travel to another at all.
    //
    // The STOREFRONT keeps the domain: a customer session is read by the frontend host for SSR and by
    // the api host for its calls, and those are different hosts on purpose.
    const domain = RequestSurfaceUtils.isAdminRequestContext(req)
      ? undefined
      : ApiUrlUtils.getCookieDomain(req);
    if (domain) {
      options.domain = domain;
    }

    return options;
  }
}
