import { Request, Response } from 'express';
import { ApiPathUtils, CoercionUtils, CookieConstants, RequestContextUtils, RouteConstants, SystemConstants } from '@fromcode119/core';
import { ApiConfig } from '@api/config/api-config';
import { AuthControllerSso } from '@api/controllers/auth/auth-controller-sso';
import { SsoOauthProvider } from '@api/controllers/auth/sso/enums/sso-oauth-provider.enum';
import { SsoSignInError } from '@api/controllers/auth/sso/enums/sso-sign-in-error.enum';
import { SsoOauthClientFactory } from '@api/controllers/auth/sso/sso-oauth-client-factory';
import { SsoOauthState } from '@api/controllers/auth/sso/sso-oauth-state';
import { WorkspaceAccessDeniedError } from '@api/services/request/workspace-access-denied-error';

/**
 * "Continue with Google / Microsoft / GitHub" on the storefront: the OAuth redirect sign-in.
 *
 * `start` sends the browser to the provider with a fresh state and PKCE challenge; the provider sends
 * it back to `callback`, which exchanges the code on the back channel, signs the account in with the
 * same rules as every other SSO login, and returns the visitor to where they started. Every refusal is
 * a redirect back with `?ssoError=<code>`, which the storefront's sign-in buttons translate.
 *
 * The address a site registers with a provider is `<site>/api/v1/auth/sso/<provider>/callback`.
 */
export class AuthControllerSsoOauth extends AuthControllerSso {
  private static readonly HANDOFF_SECONDS = 60;

  async ssoStart(req: Request, res: Response) {
    const errorTo = SsoOauthState.localPath(CoercionUtils.toString(req.query?.errorTo)) || ApiConfig.getInstance().appRoutes.auth.LOGIN;
    const provider = SsoOauthProvider.resolve(CoercionUtils.toString(req.params?.provider));
    if (!(await this.isStorefrontSignInEnabled())) return this.refuse(res, errorTo, SsoSignInError.SIGN_IN_DISABLED);
    const client = provider ? await new SsoOauthClientFactory(this.manager).forProvider(provider) : null;
    if (!provider || !client) return this.refuse(res, errorTo, SsoSignInError.NOT_ENABLED);

    const state = SsoOauthState.begin(SsoOauthState.localPath(CoercionUtils.toString(req.query?.returnTo)) || RouteConstants.SEGMENTS.ACCOUNT, errorTo);
    const grant = await this.auth.generateGrantToken(
      { userId: provider.value, purpose: SsoOauthState.PURPOSE, scope: state.scope(provider.value, RequestContextUtils.getTenantId() ?? null) },
      { expiresIn: SsoOauthState.TTL_SECONDS },
    );
    res.cookie(CookieConstants.SSO_STATE, state.serialize(grant), this.stateCookieOptions(req, provider));
    return res.redirect(302, client.authorizationUrl(await this.ssoRedirectUri(req, provider), state.state, state.challenge));
  }

  async ssoCallback(req: Request, res: Response) {
    const provider = SsoOauthProvider.resolve(CoercionUtils.toString(req.params?.provider));
    const parsed = SsoOauthState.parse(req.cookies?.[CookieConstants.SSO_STATE]);
    if (provider) res.clearCookie(CookieConstants.SSO_STATE, { ...this.stateCookieOptions(req, provider), maxAge: undefined });
    const errorTo = parsed?.state.errorTo || ApiConfig.getInstance().appRoutes.auth.LOGIN;

    if (!provider || !parsed || !parsed.state.matches(CoercionUtils.toString(req.query?.state))) return this.refuse(res, errorTo, SsoSignInError.INVALID_STATE);
    const scope = parsed.state.scope(provider.value, RequestContextUtils.getTenantId() ?? null);
    if (!(await this.auth.verifyGrantToken(parsed.grant, { userId: provider.value, purpose: SsoOauthState.PURPOSE, scope }))) {
      return this.refuse(res, errorTo, SsoSignInError.INVALID_STATE);
    }
    if (!(await this.isStorefrontSignInEnabled())) return this.refuse(res, errorTo, SsoSignInError.SIGN_IN_DISABLED);
    const code = CoercionUtils.toString(req.query?.code);
    if (req.query?.error || !code) return this.refuse(res, errorTo, SsoSignInError.PROVIDER);
    const client = await new SsoOauthClientFactory(this.manager).forProvider(provider);
    if (!client) return this.refuse(res, errorTo, SsoSignInError.NOT_ENABLED);

    let identity;
    try {
      identity = await client.identify(code, await this.ssoRedirectUri(req, provider), parsed.state.verifier);
    } catch (error: any) {
      this.logger.warn(`[AuthController] ${provider.value} sign-in failed at the provider: ${error?.message || error}`);
      return this.refuse(res, errorTo, SsoSignInError.PROVIDER);
    }

    const user = await this.resolveSsoAccount(req, identity, provider.value);
    if (user instanceof SsoSignInError) return this.refuse(res, errorTo, user);
    // A redirect cannot stop to ask for the second factor, and skipping it would make the provider a way
    // around it. The account signs in with its password and code instead.
    if (await this.isTwoFactorEnabled(user.id)) return this.refuse(res, errorTo, SsoSignInError.TWO_FACTOR);

    let loginResult;
    try {
      loginResult = await this.completeSsoSignIn(req, res, user, provider.value);
    } catch (error) {
      if (error instanceof WorkspaceAccessDeniedError) return this.refuse(res, errorTo, SsoSignInError.WORKSPACE_DENIED);
      throw error;
    }
    // The session cookie is httpOnly, so the page cannot see who signed in. The client session store
    // adopts this short-lived summary on the next page — the same user a password login returns.
    const summary = { id: loginResult.user?.id, email: loginResult.user?.email, firstName: loginResult.user?.firstName, lastName: loginResult.user?.lastName, roles: loginResult.user?.roles };
    // Host-only (no Domain), so the page that reads it can also delete it.
    res.cookie(CookieConstants.SSO_HANDOFF, Buffer.from(JSON.stringify(summary)).toString('base64url'), {
      ...this.getCookieOptions(req, false, AuthControllerSsoOauth.HANDOFF_SECONDS * 1000),
      httpOnly: false,
      domain: undefined,
    });
    return res.redirect(302, parsed.state.returnTo);
  }

  /** The callback address registered with the provider: on this site's own storefront host. */
  protected async ssoRedirectUri(req: Request, provider: SsoOauthProvider): Promise<string> {
    const path = ApiPathUtils.versioned(ApiPathUtils.fillPath(SystemConstants.API_PATH.AUTH.SSO_CALLBACK, { provider: provider.value }));
    return `${await this.getFrontendBaseUrl(req)}${path}`;
  }

  /** A redirect sign-in is always a storefront sign-in, whatever surface the provider's redirect looks like. */
  private async isStorefrontSignInEnabled(): Promise<boolean> {
    return this.getSettingBoolean(SystemConstants.META_KEY.FRONTEND_AUTH_ENABLED, true);
  }

  /** The state cookie travels only to this provider's callback, and lives as long as the grant sealing it. */
  private stateCookieOptions(req: Request, provider: SsoOauthProvider) {
    return {
      ...this.getCookieOptions(req, false, SsoOauthState.TTL_SECONDS * 1000),
      path: ApiPathUtils.versioned(ApiPathUtils.fillPath(SystemConstants.API_PATH.AUTH.SSO_CALLBACK, { provider: provider.value })),
    };
  }

  private refuse(res: Response, path: string, error: SsoSignInError) {
    const url = new URL(path, 'http://local');
    url.searchParams.set('ssoError', error.value);
    return res.redirect(302, `${url.pathname}${url.search}${url.hash}`);
  }
}
