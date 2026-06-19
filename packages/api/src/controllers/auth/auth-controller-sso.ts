import { Request, Response } from 'express';
import { SystemConstants } from '@fromcode119/core';
import { randomBytes } from 'crypto';
import { AuthControllerRegistration } from './auth-controller-registration';

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
      if (accountStatus !== 'active') {
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
        { userId: user.id, email, ip: req.ip, emailSent }
      ).catch(() => {});

      return res.json({ success: true, message: genericMessage });
    } catch (error) {
      this.logger.error(`[AuthController] forgotPassword failed: ${error}`);
      return res.json({ success: true, message: genericMessage });
    }
  }

  async resetPassword(req: Request, res: Response) {
    if (!(await this.isFrontendAuthEnabledForRequest(req))) {
      return res.status(404).json({ error: 'Not found' });
    }

    const token = String(req.body?.token || '').trim();
    const newPassword = String(req.body?.newPassword || req.body?.password || '').trim();
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    const tokenResult = await this.consumePasswordResetToken(token);
    if (!tokenResult.ok || !tokenResult.userId || !tokenResult.email) {
      return res.status(400).json({
        error: tokenResult.reason === 'expired'
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
      { userId: tokenResult.userId, email: tokenResult.email, ip: req.ip }
    ).catch(() => {});

    await this.sendSecurityNotification({
      userId: tokenResult.userId,
      to: tokenResult.email,
      subject: 'Your password was reset',
      title: 'Your password has been reset successfully.',
      details: [`Time: ${new Date().toISOString()}`]
    });

    return res.json({ success: true, message: 'Password has been reset. Please sign in again.' });
  }

  async getSsoProviders(req: Request, res: Response) {
    const providers = await this.getConfiguredSsoProviders();
    return res.json({ providers });
  }

  async ssoLogin(req: Request, res: Response) {
    const provider = String(req.body?.provider || '').trim().toLowerCase();
    const idToken = String(req.body?.idToken || '').trim();
    const accessToken = String(req.body?.accessToken || '').trim();

    if (!provider) return res.status(400).json({ error: 'SSO provider is required' });
    if (!idToken && !accessToken) return res.status(400).json({ error: 'idToken or accessToken is required' });

    const providers = await this.getConfiguredSsoProviders();
    if (!providers.includes(provider)) {
      return res.status(400).json({ error: `Provider "${provider}" is not enabled` });
    }

    let payload: any;
    try {
      payload = await this.manager.hooks.call('auth:sso:resolve-user', {
        provider,
        idToken,
        accessToken,
        profile: req.body?.profile || null,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || 'SSO provider rejected this login' });
    }

    const email = this.normalizeEmail(payload?.email);
    if (!email || !this.isValidEmail(email)) {
      return res.status(400).json({ error: 'SSO payload did not provide a valid email' });
    }

    let user = await this.db.findOne(SystemConstants.TABLE.USERS, { email });
    if (!user) {
      const generatedPassword = randomBytes(24).toString('hex');
      const hashedPassword = await this.auth.hashPassword(generatedPassword);
      user = await this.db.insert(SystemConstants.TABLE.USERS, {
        email,
        password: hashedPassword,
        roles: Array.isArray(payload?.roles) && payload.roles.length > 0 ? payload.roles : ['customer'],
        firstName: String(payload?.firstName || '').trim() || null,
        lastName: String(payload?.lastName || '').trim() || null
      });
      await this.setUserAccountStatus(user.id, 'active');
      await this.setForcePasswordReset(user.id, false);
      await this.pushPasswordHistory(user.id, hashedPassword);
      await this.upsertMeta(this.getPasswordChangedAtKey(user.id), new Date().toISOString());
      if (payload?.emailVerified !== false) {
        await this.setEmailVerified(user.id, true);
      }
    }

    const status = await this.getUserAccountStatus(user.id);
    if (status !== 'active') {
      return res.status(403).json({ error: 'Account is not active' });
    }
    if (payload?.emailVerified !== false) {
      await this.setEmailVerified(user.id, true);
    }

    // App-level 2FA applies on SSO too: an account that enrolled in 2FA must
    // not be able to skip it by logging in through a provider.
    if (!(await this.enforceTwoFactorChallenge(req, res, user))) {
      return;
    }

    const loginResult = await this.issueLoginSession(req, res, user);
    await this.clearLoginThrottleState(this.getLoginThrottleKey(email, req.ip || ''));

    await this.manager.writeLog(
      'INFO',
      `SSO login for ${email} via ${provider}`,
      'system',
      { userId: user.id, email, provider, ip: req.ip }
    ).catch(() => {});

    return res.json({
      token: loginResult.token,
      user: loginResult.user
    });
  }
}
