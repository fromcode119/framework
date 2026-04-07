import { Request, Response } from 'express';
import { PluginManager } from '@fromcode119/core';
import { SystemConstants } from '@fromcode119/core';
import { randomBytes } from 'crypto';
import { AuthControllerRegistration } from './auth-controller-registration';

export class AuthControllerLifecycle extends AuthControllerRegistration {
  async getStatus(req: Request, res: Response) {
    try {
      const initialized = (await this.db.count(SystemConstants.TABLE.USERS)) > 0;

      if (!initialized) {
        this.clearAuthCookies(req, res);
      }

      res.json({ initialized });
    } catch {
      res.json({ initialized: false });
    }
  }

  async setup(req: Request, res: Response) {
    try {
      if ((await this.db.count(SystemConstants.TABLE.USERS)) > 0) {
        return res.status(400).json({ error: 'System already initialized' });
      }
    } catch (e) {
      this.logger.error(`[AuthController] Setup initialization failed: ${e}`);
    }

    const { email, password } = req.body || {};
    const normalizedEmail = this.normalizeEmail(email);
    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const passwordError = await this.validatePasswordAgainstPolicy(String(password), {
      email: normalizedEmail
    });
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const hashedPassword = await this.auth.hashPassword(String(password));
    const newUser: any = await this.db.insert(SystemConstants.TABLE.USERS, {
      email: normalizedEmail,
      password: hashedPassword,
      roles: ['admin']
    });

    await this.setEmailVerified(newUser.id, true);
    await this.setUserAccountStatus(newUser.id, 'active');
    await this.setForcePasswordReset(newUser.id, false);
    await this.pushPasswordHistory(newUser.id, hashedPassword);
    await this.upsertMeta(this.getPasswordChangedAtKey(newUser.id), new Date().toISOString());

    const loginResult = await this.issueLoginSession(req, res, newUser);

    await this.manager.writeLog(
      'INFO',
      `System initialized. Admin account created: ${normalizedEmail}`,
      'system',
      { userId: newUser.id, email: normalizedEmail, ip: req.ip }
    ).catch(() => {});

    res.json({
      token: loginResult.token,
      user: loginResult.user
    });
  }

  async login(req: Request, res: Response) {
    const { password, totpToken, recoveryCode, captchaToken } = req.body || {};
    const email = this.normalizeEmail(req.body?.email);
    const throttleKey = this.getLoginThrottleKey(email, req.ip || '');
    const throttleSettings = await this.getLoginThrottleSettings();
    const throttleState = await this.readLoginThrottleState(throttleKey);

    try {
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
      }

      if (this.isLoginLocked(throttleState)) {
        return res.status(429).json({
          error: 'Too many failed login attempts. Please try again later.',
          lockedUntil: throttleState.lockedUntil || null
        });
      }

      if (this.requiresCaptcha(throttleState, throttleSettings) && !String(captchaToken || '').trim()) {
        return res.status(400).json({
          error: 'Captcha verification is required for this login attempt.',
          requiresCaptcha: true
        });
      }

      if (this.requiresCaptcha(throttleState, throttleSettings) && String(captchaToken || '').trim()) {
        try {
          const captchaResult: any = await this.manager.hooks.call('auth:captcha:verify', {
            token: String(captchaToken || '').trim(),
            ip: req.ip,
            email
          });
          if (captchaResult && captchaResult.valid === false) {
            return res.status(400).json({
              error: captchaResult.message || 'Captcha verification failed.',
              requiresCaptcha: true
            });
          }
        } catch (captchaError: any) {
          return res.status(400).json({
            error: captchaError?.message || 'Captcha verification failed.',
            requiresCaptcha: true
          });
        }
      }

      const user = await this.db.findOne(SystemConstants.TABLE.USERS, { email });

      if (user) {
        const status = await this.getUserAccountStatus(user.id);
        if (status === 'suspended') {
          await this.recordLoginFailure(throttleKey, throttleSettings);
          await this.manager.writeLog('WARN', `Blocked login for suspended account: ${email}`, 'system', {
            userId: user.id,
            email,
            ip: req.ip
          }).catch(() => {});
          return res.status(403).json({
            error: 'Account is suspended. Please contact support.'
          });
        }

        const isMatch = await this.auth.comparePassword(String(password), user.password || '');
        if (!isMatch) {
          await this.recordLoginFailure(throttleKey, throttleSettings);
          await this.manager.writeLog(
            'WARN',
            `Failed login attempt for ${email} (Invalid Password)`,
            'system',
            { email, ip: req.ip }
          ).catch(() => {});
          return res.status(401).json({ error: 'Invalid email or password' });
        }

        const requiresEmailVerification = await this.requiresEmailVerification(user.id);
        if (requiresEmailVerification) {
          await this.recordLoginFailure(throttleKey, throttleSettings);
          return res.status(403).json({
            error: 'Email not verified',
            requiresEmailVerification: true,
            message: 'Please verify your email before signing in.'
          });
        }

        const forceReset = await this.getForcePasswordReset(user.id);
        if (forceReset) {
          await this.recordLoginFailure(throttleKey, throttleSettings);
          return res.status(403).json({
            error: 'Password reset required before login.',
            requiresPasswordReset: true
          });
        }

        const twoFactorMeta = await this.db.findOne(SystemConstants.TABLE.META, {
          key: `user:${user.id}:2fa_enabled`
        });

        if (twoFactorMeta?.value === 'true') {
          const hasTotpToken = !!String(totpToken || '').trim();
          const hasRecoveryCode = !!String(recoveryCode || '').trim();

          if (!hasTotpToken && !hasRecoveryCode) {
            return res.status(200).json({
              requiresTwoFactor: true,
              message: 'Please provide your 2FA token or recovery code'
            });
          }

          let twoFactorVerified = false;
          let twoFactorMethod: 'totp' | 'recovery' | null = null;

          if (hasTotpToken) {
            const secretRow = await this.db.findOne(SystemConstants.TABLE.META, {
              key: `user:${user.id}:totp_secret`
            });

            if (secretRow?.value && this.verifyTOTP(secretRow.value, String(totpToken).trim())) {
              twoFactorVerified = true;
              twoFactorMethod = 'totp';
            }
          }

          if (!twoFactorVerified && hasRecoveryCode) {
            const consumed = await this.consumeRecoveryCode(user.id, String(recoveryCode || '').trim());
            if (consumed) {
              twoFactorVerified = true;
              twoFactorMethod = 'recovery';
            }
          }

          if (!twoFactorVerified) {
            await this.recordLoginFailure(throttleKey, throttleSettings);
            await this.manager.writeLog(
              'WARN',
              `Failed 2FA attempt for ${user.email}`,
              'system',
              { userId: user.id, ip: req.ip }
            ).catch(() => {});
            return res.status(401).json({ error: 'Invalid 2FA token or recovery code' });
          }

          await this.manager.writeLog(
            'INFO',
            `Successful 2FA challenge (${twoFactorMethod}) for ${user.email}`,
            'system',
            { userId: user.id, email: user.email, ip: req.ip, method: twoFactorMethod }
          ).catch(() => {});
        }

        await this.clearLoginThrottleState(throttleKey);
        const loginResult = await this.issueLoginSession(req, res, user);

        await this.manager.writeLog(
          'INFO',
          `Successful login for ${user.email}`,
          'system',
          {
            userId: user.id,
            email: user.email,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            jti: loginResult.user.jti,
            twoFactorUsed: !!(totpToken || recoveryCode)
          }
        ).catch(() => {});

        await this.sendSecurityNotification({
          userId: user.id,
          to: user.email,
          subject: 'New login detected',
          title: 'A new login was detected on your account.',
          details: [
            `IP address: ${String(req.ip || 'unknown')}`,
            `User-Agent: ${String(req.headers['user-agent'] || 'unknown')}`,
            `Time: ${new Date().toISOString()}`
          ]
        });

        return res.json({
          token: loginResult.token,
          user: loginResult.user
        });
      }

      await this.recordLoginFailure(throttleKey, throttleSettings);
      await this.manager.writeLog(
        'WARN',
        `Failed login attempt for non-existent user: ${email}`,
        'system',
        { email, ip: req.ip }
      ).catch(() => {});
      return res.status(401).json({ error: 'Invalid email or password' });
    } catch (err: any) {
      this.logger.error(`[AuthController] Login exception for ${email}: ${err}`);
      return res.status(500).json({ error: 'Internal server error during login' });
    }
  }

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
