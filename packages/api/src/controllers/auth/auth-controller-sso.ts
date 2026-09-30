import { WorkspaceAccessDeniedError } from '@api/services/request/workspace-access-denied-error';
import { AccountStatus } from '@api/controllers/auth/enums/account-status.enum';
import { TokenErrorReason } from '@api/controllers/auth/enums/token-error-reason.enum';
import { Request, Response } from 'express';
import { NetworkAddressUtils, SystemConstants } from '@fromcode119/core';
import { randomBytes } from 'crypto';
import { AuthControllerRegistration } from '@api/controllers/auth/auth-controller-registration';
import { CoercionUtils } from '@fromcode119/core';
import { SecurityNotificationEvent } from '@api/controllers/auth/enums/security-notification-event.enum';
import { SsoSignInError } from '@api/controllers/auth/sso/enums/sso-sign-in-error.enum';
import { SsoIdentity } from '@api/controllers/auth/sso/sso-identity';
import { SsoOauthClientFactory } from '@api/controllers/auth/sso/sso-oauth-client-factory';

/**
 * Password-reset (forgot/reset) and SSO login handlers. Extracted from
 * AuthControllerLifecycle to keep each layer under the file-size limit;
 * AuthControllerLifecycle extends this class so the public (req,res) handlers
 * remain on the same controller instance with identical signatures/behavior.
 */
export class AuthControllerSso extends AuthControllerRegistration {
  async forgotPassword(req: Request, res: Response) {
    if (!(await this.isFrontendAuthEnabledForRequest(req))) {
      return res.status(404).json({ error: 'Not found' });
    }

    const email = this.normalizeEmail(req.body?.email);
    const toContextString = (value: any): string => {
      if (typeof value === 'string') return value.trim().toLowerCase();
      if (Array.isArray(value)) return toContextString(value[0]);
      if (value && typeof value === 'object') {
        if ('context' in value) return toContextString((value as any).context);
        if ('value' in value) return toContextString((value as any).value);
      }
      return '';
    };
    const contextFromUrl = (() => {
      try {
        const queryPart = String((req as any).originalUrl || '').split('?')[1] || '';
        if (!queryPart) return '';
        return toContextString(new URLSearchParams(queryPart).get('context'));
      } catch {
        return '';
      }
    })();
    const rawContextHint =
      toContextString(req.get('x-reset-context')) ||
      toContextString(req.body?.context) ||
      contextFromUrl ||
      toContextString((req.query as any)?.context) ||
      toContextString(req.get('x-framework-client'));
    const contextHint = this.normalizeResetContextHint(rawContextHint);
    if (!email || !this.isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email is required' });
    }

    const genericMessage = 'If an account exists, a password reset link has been sent.';

    try {
      const user = await this.db.findOne(SystemConstants.TABLE.USERS, { email });
      if (!user) {
        return res.json({ success: true, message: genericMessage });
      }

      const accountStatus = await this.getUserAccountStatus(user.id);
      if (accountStatus !== AccountStatus.ACTIVE) {
        return res.json({ success: true, message: genericMessage });
      }

      const issued = await this.issuePasswordResetToken(user.id, email);
      const resetUrl = await this.buildPasswordResetUrl(req, issued.token, contextHint);
      const emailSent = await this.sendPasswordResetEmail({
        to: email,
        resetUrl,
        firstName: this.readUserFirstName(user)
      });

      await this.manager.writeLog(
        'INFO',
        `Password reset requested for ${email}`,
        'system',
        { userId: user.id, email, ip: NetworkAddressUtils.resolveClientIp(req), emailSent }
      ).catch(() => {});

      return res.json({ success: true, message: genericMessage });
    } catch (error) {
      this.logger.error(`[AuthController] forgotPassword failed: ${error}`);
      return res.json({ success: true, message: genericMessage });
    }
  }

  /**
   * Admin-triggered "send a password-reset / set-password email" for a specific user. Reuses the exact
   * same token + email flow as the public forgot-password handler, but is admin-authoritative: it is
   * guarded by the admin role at the route, targets a user by id (or email), and does not mask the result
   * behind the generic "if an account exists" message — the admin chose the recipient. Use to (re)send a
   * partner/customer their set-password link when the original was missed/delayed.
   */
  async adminSendPasswordReset(req: Request, res: Response) {
    const userId = req.body?.userId != null && CoercionUtils.toString(req.body.userId) !== '' ? req.body.userId : null;
    const email = this.normalizeEmail(req.body?.email);
    try {
      const user = userId != null
        ? await this.db.findOne(SystemConstants.TABLE.USERS, { id: userId })
        : (email ? await this.db.findOne(SystemConstants.TABLE.USERS, { email }) : null);
      if (!user) return res.status(404).json({ error: 'User not found' });

      const targetEmail = this.normalizeEmail(user.email);
      if (!targetEmail) return res.status(400).json({ error: 'User has no email address' });

      const issued = await this.issuePasswordResetToken(user.id, targetEmail);
      const resetUrl = await this.buildPasswordResetUrl(req, issued.token, 'frontend');
      const emailSent = await this.sendPasswordResetEmail({
        to: targetEmail,
        resetUrl,
        firstName: this.readUserFirstName(user)
      });

      await this.manager.writeLog(
        'INFO',
        `Admin sent password reset for ${targetEmail}`,
        'system',
        { userId: user.id, byAdmin: (req as any).user?.id, emailSent }
      ).catch(() => {});

      return res.json({ success: true, emailSent, email: targetEmail });
    } catch (error) {
      this.logger.error(`[AuthController] adminSendPasswordReset failed: ${error}`);
      return res.status(500).json({ error: 'Failed to send password reset email' });
    }
  }

  async resetPassword(req: Request, res: Response) {
    if (!(await this.isFrontendAuthEnabledForRequest(req))) {
      return res.status(404).json({ error: 'Not found' });
    }

    const token = CoercionUtils.toString(req.body?.token);
    const newPassword = CoercionUtils.toString(req.body?.newPassword) || CoercionUtils.toString(req.body?.password);
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    const tokenResult = await this.consumePasswordResetToken(token);
    if (!tokenResult.ok || !tokenResult.userId || !tokenResult.email) {
      return res.status(400).json({
        error: tokenResult.reason === TokenErrorReason.EXPIRED
          ? 'Password reset link has expired. Please request a new one.'
          : 'Invalid password reset token'
      });
    }

    const user = await this.db.findOne(SystemConstants.TABLE.USERS, { id: tokenResult.userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const passwordError = await this.validatePasswordAgainstPolicy(newPassword, {
      userId: tokenResult.userId,
      email: tokenResult.email,
      currentPasswordHash: String(user.password || '')
    });
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const hashed = await this.auth.hashPassword(newPassword);
    await this.db.update(SystemConstants.TABLE.USERS, { id: tokenResult.userId }, { password: hashed, updatedAt: new Date() });
    await this.pushPasswordHistory(tokenResult.userId, hashed);
    await this.upsertMeta(this.getPasswordChangedAtKey(tokenResult.userId), new Date().toISOString());
    await this.setForcePasswordReset(tokenResult.userId, false);
    await this.revokeAllSessionsForUser(tokenResult.userId);

    await this.manager.writeLog(
      'INFO',
      `Password reset completed for ${tokenResult.email}`,
      'system',
      { userId: tokenResult.userId, email: tokenResult.email, ip: NetworkAddressUtils.resolveClientIp(req) }
    ).catch(() => {});

    await this.sendSecurityNotification({
      userId: tokenResult.userId,
      to: tokenResult.email,
      event: SecurityNotificationEvent.PASSWORD_RESET,
    });

    return res.json({ success: true, message: 'Password has been reset. Please sign in again.' });
  }

  /** The providers a visitor can sign in with here: switched on, with the credentials a redirect needs. */
  async getSsoProviders(req: Request, res: Response) {
    const available = await new SsoOauthClientFactory(this.manager).available();
    return res.json({ providers: available.map((item) => ({ key: item.provider.value, label: item.label })) });
  }

  async ssoLogin(req: Request, res: Response) {
    const provider = CoercionUtils.toKey(req.body?.provider);
    const idToken = CoercionUtils.toString(req.body?.idToken);
    const accessToken = CoercionUtils.toString(req.body?.accessToken);

    if (!provider) return res.status(400).json({ error: 'SSO provider is required' });
    if (!idToken && !accessToken) return res.status(400).json({ error: 'idToken or accessToken is required' });

    const providers = await this.getConfiguredSsoProviders();
    if (!providers.includes(provider)) {
      return res.status(SsoSignInError.NOT_ENABLED.status).json({ error: SsoSignInError.NOT_ENABLED.value });
    }

    let payload: any;
    try {
      payload = await this.manager.hooks.call('auth:sso:resolve-user', {
        provider,
        idToken,
        accessToken,
        profile: req.body?.profile || null,
        ip: NetworkAddressUtils.resolveClientIp(req),
        userAgent: req.headers['user-agent']
      });
    } catch (err: any) {
      if (err instanceof WorkspaceAccessDeniedError) return res.status(403).json({ error: WorkspaceAccessDeniedError.CODE, message: err.message });
      return res.status(400).json({ error: err?.message || 'SSO provider rejected this login' });
    }

    const user = await this.resolveSsoAccount(req, SsoIdentity.from(payload), provider);
    if (user instanceof SsoSignInError) return res.status(user.status).json({ error: user.value });

    // App-level 2FA applies on SSO too: an account that enrolled in 2FA must
    // not be able to skip it by logging in through a provider.
    if (!(await this.enforceTwoFactorChallenge(req, res, user))) {
      return;
    }

    const loginResult = await this.completeSsoSignIn(req, res, user, provider);
    return res.json({ token: loginResult.token, user: loginResult.user });
  }

  /**
   * The account a provider's identity signs into, or why it may not.
   *
   * The email is what joins a provider identity to an account here, so it counts only when the provider
   * vouches for it: an address the provider did not verify would let anyone who can type it into a
   * provider profile sign in as its owner. An existing account with that address is signed in (never
   * duplicated); otherwise a customer account is created, but only where registration is open.
   */
  protected async resolveSsoAccount(req: Request, identity: SsoIdentity, provider: string): Promise<any | SsoSignInError> {
    if (!(await this.isFrontendAuthEnabledForRequest(req))) return SsoSignInError.SIGN_IN_DISABLED;
    if (!identity.emailVerified || !identity.email || !this.isValidEmail(identity.email)) return SsoSignInError.UNVERIFIED_EMAIL;

    let user = await this.db.findOne(SystemConstants.TABLE.USERS, { email: identity.email });
    if (!user) {
      if (!(await this.isFrontendRegistrationEnabled())) return SsoSignInError.REGISTRATION_CLOSED;
      const hashedPassword = await this.auth.hashPassword(randomBytes(24).toString('hex'));
      user = await this.db.insert(SystemConstants.TABLE.USERS, {
        email: identity.email, password: hashedPassword, roles: ['customer'],
        firstName: identity.firstName, lastName: identity.lastName,
      });
      await this.setUserAccountStatus(user.id, AccountStatus.ACTIVE);
      await this.setForcePasswordReset(user.id, false);
      await this.pushPasswordHistory(user.id, hashedPassword);
      await this.upsertMeta(this.getPasswordChangedAtKey(user.id), new Date().toISOString());
      this.manager.hooks.emit('auth:user:registered', { userId: user.id, email: identity.email, context: { ssoProvider: provider } });
    }

    if ((await this.getUserAccountStatus(user.id)) !== AccountStatus.ACTIVE) return SsoSignInError.ACCOUNT_INACTIVE;
    await this.setEmailVerified(user.id, true);
    await this.joinStorefrontSite(req, user.id);
    return user;
  }

  /** Issues the session for an account a provider signed in, and records it. */
  protected async completeSsoSignIn(req: Request, res: Response, user: any, provider: string) {
    const email = this.normalizeEmail(user.email);
    const loginResult = await this.issueLoginSession(req, res, user);
    await this.clearLoginThrottleState(this.getLoginThrottleKey(email, NetworkAddressUtils.resolveClientIp(req) || ''));
    await this.manager.writeLog(
      'INFO',
      `SSO login for ${email} via ${provider}`,
      'system',
      { userId: user.id, email, provider, ip: NetworkAddressUtils.resolveClientIp(req) }
    ).catch(() => {});
    return loginResult;
  }
}
