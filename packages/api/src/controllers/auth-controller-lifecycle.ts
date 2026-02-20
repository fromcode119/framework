import { Request, Response } from 'express';
import { users, systemRoles, eq, count } from '@fromcode/database';
import { randomBytes } from 'crypto';
import { AuthControllerTokenSupport } from './auth-controller-token-support';

export class AuthControllerLifecycle extends AuthControllerTokenSupport {
  async getStatus(req: Request, res: Response) {
    try {
      const result = await this.db
        .select({ total: count() })
        .from(users);

      const initialized = Number(result[0].total) > 0;

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
      const check = await this.db.select({ total: count() }).from(users);
      if (Number(check[0].total) > 0) {
        return res.status(400).json({ error: 'System already initialized' });
      }

      await this.db.insert(systemRoles).values([
        {
          slug: 'admin',
          name: 'Administrator',
          description: 'Complete unrestricted access to all system modules and settings.',
          type: 'system',
          permissions: JSON.stringify(['*'])
        },
        {
          slug: 'editor',
          name: 'Content Editor',
          description: 'Can create, edit and delete collections but cannot modify system settings.',
          type: 'custom',
          permissions: JSON.stringify(['content:read', 'content:write'])
        },
        {
          slug: 'user',
          name: 'Standard User',
          description: 'Regular account with access to assigned frontend capabilities only.',
          type: 'custom',
          permissions: JSON.stringify([])
        }
      ]).onConflictDoNothing();
    } catch (e) {
      console.error('[AuthController] Setup initialization failed:', e);
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
    const [newUser]: any = await this.db.insert(users)
      .values({
        email: normalizedEmail,
        password: hashedPassword,
        roles: ['admin']
      })
      .returning();

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

  async register(req: Request, res: Response) {
    if (!(await this.isFrontendAuthEnabledForRequest(req))) {
      return res.status(404).json({ error: 'Not found' });
    }
    if (!(await this.isFrontendRegistrationEnabled())) {
      return res.status(404).json({ error: 'Not found' });
    }

    const { email, password, firstName, lastName, checkoutSessionId, cartId, orderId } = req.body || {};
    const normalizedEmail = this.normalizeEmail(email);

    if (!normalizedEmail || !this.isValidEmail(normalizedEmail)) {
      return res.status(400).json({ error: 'A valid email is required' });
    }

    const passwordError = await this.validatePasswordAgainstPolicy(String(password || ''), {
      email: normalizedEmail
    });
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const existing = await this.db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
    if (existing?.[0]) {
      return res.status(409).json({ error: 'Email is already registered' });
    }

    const hashedPassword = await this.auth.hashPassword(String(password));
    const [newUser]: any = await this.db.insert(users)
      .values({
        email: normalizedEmail,
        password: hashedPassword,
        roles: ['customer'],
        firstName: String(firstName || '').trim() || null,
        lastName: String(lastName || '').trim() || null
      })
      .returning();

    await this.setUserAccountStatus(newUser.id, 'active');
    await this.setForcePasswordReset(newUser.id, false);
    await this.pushPasswordHistory(newUser.id, hashedPassword);
    await this.upsertMeta(this.getPasswordChangedAtKey(newUser.id), new Date().toISOString());

    const checkoutContext = {
      checkoutSessionId: String(checkoutSessionId || '').trim() || undefined,
      cartId: String(cartId || '').trim() || undefined,
      orderId: String(orderId || '').trim() || undefined
    };

    const verification = await this.issueEmailVerificationToken(newUser.id, normalizedEmail, checkoutContext);
    const verificationUrl = await this.buildEmailVerificationUrl(req, verification.token);
    const emailSent = await this.sendVerificationEmail({
      to: normalizedEmail,
      verificationUrl,
      firstName: String(firstName || '').trim()
    });

    this.manager.hooks.emit('auth:user:registered', {
      userId: newUser.id,
      email: normalizedEmail,
      checkout: checkoutContext
    });

    await this.manager.writeLog(
      'INFO',
      `User registered: ${normalizedEmail}`,
      'system',
      { userId: newUser.id, email: normalizedEmail, checkout: checkoutContext, emailVerificationSent: emailSent }
    ).catch(() => {});

    if (!emailSent && process.env.NODE_ENV === 'production') {
      return res.status(500).json({ error: 'Unable to send verification email. Please try again later.' });
    }

    const response: Record<string, any> = {
      success: true,
      requiresEmailVerification: true,
      message: 'Registration successful. Please verify your email before signing in.',
      user: {
        id: String(newUser.id),
        email: normalizedEmail,
        roles: ['customer']
      }
    };

    if (process.env.NODE_ENV !== 'production') {
      response.verificationUrl = verificationUrl;
      response.emailDelivery = emailSent ? 'sent' : 'failed';
    }

    return res.status(201).json(response);
  }

  async verifyEmail(req: Request, res: Response) {
    if (!(await this.isFrontendAuthEnabledForRequest(req))) {
      return res.status(404).json({ error: 'Not found' });
    }

    const token = String(req.body?.token || req.query?.token || '').trim();
    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const result = await this.consumeEmailVerificationToken(token);
    if (!result.ok) {
      return res.status(400).json({
        error: result.reason === 'expired'
          ? 'Verification link has expired. Please request a new one.'
          : 'Invalid verification token'
      });
    }

    this.manager.hooks.emit('auth:user:verified', {
      userId: result.userId,
      email: result.email,
      checkout: result.checkout
    });

    if (result.checkout && Object.values(result.checkout).some(Boolean)) {
      this.manager.hooks.emit('auth:user:checkout-link', {
        userId: result.userId,
        email: result.email,
        checkout: result.checkout
      });
    }

    await this.manager.writeLog(
      'INFO',
      `Email verified for user ${result.email}`,
      'system',
      { userId: result.userId, email: result.email, checkout: result.checkout }
    ).catch(() => {});

    return res.json({
      success: true,
      message: 'Email verified successfully. You can now sign in.',
      user: {
        id: String(result.userId),
        email: result.email
      }
    });
  }

  async resendVerification(req: Request, res: Response) {
    if (!(await this.isFrontendAuthEnabledForRequest(req))) {
      return res.status(404).json({ error: 'Not found' });
    }

    const email = this.normalizeEmail(req.body?.email);
    if (!email || !this.isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email is required' });
    }

    const results = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = results?.[0];
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account exists, a verification email has been sent.'
      });
    }

    const verified = await this.isEmailVerified(user.id);
    if (verified) {
      return res.json({
        success: true,
        message: 'Email is already verified.'
      });
    }

    const verification = await this.issueEmailVerificationToken(user.id, email);
    const verificationUrl = await this.buildEmailVerificationUrl(req, verification.token);
    const emailSent = await this.sendVerificationEmail({
      to: email,
      verificationUrl,
      firstName: String(user.firstName || '').trim()
    });

    if (!emailSent && process.env.NODE_ENV === 'production') {
      return res.status(500).json({ error: 'Unable to send verification email. Please try again later.' });
    }

    const response: Record<string, any> = {
      success: true,
      message: 'Verification email sent.'
    };

    if (process.env.NODE_ENV !== 'production') {
      response.verificationUrl = verificationUrl;
      response.emailDelivery = emailSent ? 'sent' : 'failed';
    }

    return res.json(response);
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

      const results = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
      const user = results[0];

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

        const db = (this.manager as any).db;
        const twoFactorMeta = await db.findOne('_system_meta', {
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
            const secretRow = await db.findOne('_system_meta', {
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
      console.error(`[AuthController] Login exception for ${email}:`, err);
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
    const contextHint = rawContextHint.includes('admin')
      ? 'admin'
      : rawContextHint.includes('frontend')
        ? 'frontend'
        : '';
    if (!email || !this.isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email is required' });
    }

    const genericMessage = 'If an account exists, a password reset link has been sent.';

    try {
      const result = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
      const user = result?.[0];
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
        firstName: String(user.firstName || '').trim()
      });

      await this.manager.writeLog(
        'INFO',
        `Password reset requested for ${email}`,
        'system',
        { userId: user.id, email, ip: req.ip, emailSent }
      ).catch(() => {});

      return res.json({ success: true, message: genericMessage });
    } catch (error) {
      console.error('[AuthController] forgotPassword failed:', error);
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

    const user = await this.db.select().from(users).where(eq(users.id, tokenResult.userId)).limit(1).then((rows: any[]) => rows?.[0]);
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
    await this.db.update(users).set({ password: hashed, updatedAt: new Date() }).where(eq(users.id, tokenResult.userId));
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

    let user = await this.db.select().from(users).where(eq(users.email, email)).limit(1).then((rows: any[]) => rows?.[0]);
    if (!user) {
      const generatedPassword = randomBytes(24).toString('hex');
      const hashedPassword = await this.auth.hashPassword(generatedPassword);
      const [created]: any = await this.db.insert(users).values({
        email,
        password: hashedPassword,
        roles: Array.isArray(payload?.roles) && payload.roles.length > 0 ? payload.roles : ['customer'],
        firstName: String(payload?.firstName || '').trim() || null,
        lastName: String(payload?.lastName || '').trim() || null
      }).returning();
      user = created;
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

  protected async isFrontendAuthEnabledForRequest(req: Request): Promise<boolean> {
    if (!this.isFrontendRequestContext(req)) return true;
    return this.getSettingBoolean('frontend_auth_enabled', true);
  }

  protected async isFrontendRegistrationEnabled(): Promise<boolean> {
    return this.getSettingBoolean('frontend_registration_enabled', true);
  }

  protected isFrontendRequestContext(req: Request): boolean {
    const clientHeader = String(req.get('x-framework-client') || '').trim().toLowerCase();
    if (clientHeader.includes('frontend')) return true;

    const originBase = this.getRequestOriginBaseUrl(req);
    if (originBase) {
      try {
        return new URL(originBase).hostname.startsWith('frontend.');
      } catch {
        return false;
      }
    }

    const referer = String(req.get('referer') || '').trim();
    if (referer) {
      try {
        return new URL(referer).hostname.startsWith('frontend.');
      } catch {
        return false;
      }
    }

    return false;
  }
}
