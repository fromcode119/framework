import { Request, Response } from 'express';
import { CoercionUtils, CookieConstants, NetworkAddressUtils, PluginSignInLink, RequestContextUtils, SystemConstants } from '@fromcode119/core';
import { ApiConfig } from '@api/config/api-config';
import { AccountStatus } from '@api/controllers/auth/enums/account-status.enum';
import { AuthControllerSsoOauth } from '@api/controllers/auth/auth-controller-sso-oauth';
import { WorkspaceAccessDeniedError } from '@api/services/request/workspace-access-denied-error';

/**
 * `GET /auth/sign-in-link?token=…` — the link a plugin emailed (`context.users.issueSignInLink`).
 *
 * Signs the person in on the site the link was issued for and redirects to the path the plugin named.
 * The link is not spent on use (mail scanners open links first); it stops working when it expires or a
 * newer one is issued. A refused link lands on the sign-in page with `signInLinkError`, never a JSON page.
 */
export class AuthControllerSignInLink extends AuthControllerSsoOauth {
  private static readonly LINK_HANDOFF_SECONDS = 60;

  async signInWithLink(req: Request, res: Response) {
    const login = ApiConfig.getInstance().appRoutes.auth.LOGIN;
    const token = CoercionUtils.toString(req.query?.token);
    if (!token) return this.refuseLink(res, login, 'invalid');

    const row = await this.readMetaRow(PluginSignInLink.tokenKey(PluginSignInLink.hash(token)));
    let payload: any = null;
    try { payload = row?.value ? JSON.parse(String(row.value)) : null; } catch { payload = null; }
    const userId = Number(payload?.userId || 0);
    const expiresAt = new Date(String(payload?.expiresAt || 0)).getTime();
    if (!userId || Number.isNaN(expiresAt)) return this.refuseLink(res, login, 'invalid');
    if (expiresAt < Date.now()) return this.refuseLink(res, login, 'expired');
    // A link issued on one site does not sign anyone in on another.
    const here = String(RequestContextUtils.getTenantId() ?? '').trim() || null;
    if ((payload?.tenantId ?? null) !== here) return this.refuseLink(res, login, 'invalid');

    const user = await this.db.findOne(SystemConstants.TABLE.USERS, { id: userId });
    if (!user || this.normalizeEmail(user.email) !== this.normalizeEmail(payload?.email)) return this.refuseLink(res, login, 'invalid');
    if ((await this.getUserAccountStatus(user.id)) !== AccountStatus.ACTIVE) return this.refuseLink(res, login, 'inactive');
    // A link cannot ask for the second factor; such an account signs in with its password and code.
    if (await this.isTwoFactorEnabled(user.id)) return this.refuseLink(res, login, 'twoFactor');

    // Opening a link sent to the address proves the address.
    await this.setEmailVerified(user.id, true);
    await this.joinStorefrontSite(req, user.id);
    let loginResult;
    try {
      loginResult = await this.issueLoginSession(req, res, user);
    } catch (error) {
      if (error instanceof WorkspaceAccessDeniedError) return this.refuseLink(res, login, 'invalid');
      throw error;
    }
    await this.manager.writeLog('INFO', `Sign-in link used by ${this.normalizeEmail(user.email)}`, 'system', {
      userId: user.id, ip: NetworkAddressUtils.resolveClientIp(req),
    }).catch(() => {});

    // Same hand-off as a redirect SSO sign-in: the session cookie is httpOnly, so the next page adopts this.
    const summary = { id: loginResult.user?.id, email: loginResult.user?.email, firstName: loginResult.user?.firstName, lastName: loginResult.user?.lastName, roles: loginResult.user?.roles };
    res.cookie(CookieConstants.SSO_HANDOFF, Buffer.from(JSON.stringify(summary)).toString('base64url'), {
      ...this.getCookieOptions(req, false, AuthControllerSignInLink.LINK_HANDOFF_SECONDS * 1000),
      httpOnly: false,
      domain: undefined,
    });
    return res.redirect(302, PluginSignInLink.safeNext(payload?.next));
  }

  private refuseLink(res: Response, path: string, reason: string) {
    const url = new URL(path, 'http://local');
    url.searchParams.set('signInLinkError', reason);
    return res.redirect(302, `${url.pathname}${url.search}`);
  }
}
