import { WorkspaceAccessDeniedError } from '@api/services/request/workspace-access-denied-error';
import { AccountStatus } from '@api/controllers/auth/enums/account-status.enum';
import { TwoFactorMethod } from '@fromcode119/core';
import { Request, Response } from 'express';
import { SecretService } from '@fromcode119/core';
import { SystemConstants } from '@fromcode119/core';
import { AuthControllerSso } from '@api/controllers/auth/auth-controller-sso';
import { InitialSetupPreferences } from '@api/controllers/auth/initial-setup-preferences';
import { GatewayReloadClient } from '@api/services/tenants/gateway-reload-client';
import { SetupMode } from '@fromcode119/core';

export class AuthControllerLifecycle extends AuthControllerSso {
  private setupInProgress = false;

  async getStatus(req: Request, res: Response) {
    try {
      const initialized = (await this.db.count(SystemConstants.TABLE.USERS)) > 0;

      if (!initialized) {
        this.clearAuthCookies(req, res);
      }

      res.json({ initialized });
    } catch (error) {
      this.logger.error(`[AuthController] Initialization status read failed: ${error}`);
      res.status(503).json({ error: 'Initialization status is temporarily unavailable' });
    }
  }

  async setup(req: Request, res: Response) {
    if (this.setupInProgress) {
      return res.status(409).json({ error: 'System initialization is already in progress' });
    }

    this.setupInProgress = true;
    try {
      return await this.initializeSystem(req, res);
    } finally {
      this.setupInProgress = false;
    }
  }

  private async initializeSystem(req: Request, res: Response) {
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
    let newUser: any;
    try {
      newUser = await this.createInitialUser(normalizedEmail, hashedPassword);
    } catch (error) {
      this.logger.error(`[AuthController] Setup initialization failed: ${error}`);
      return res.status(503).json({ error: 'System initialization state is temporarily unavailable' });
    }
    if (!newUser) return res.status(400).json({ error: 'System already initialized' });

    await this.setEmailVerified(newUser.id, true);
    await this.setUserAccountStatus(newUser.id, AccountStatus.ACTIVE);
    await this.setForcePasswordReset(newUser.id, false);
    await this.pushPasswordHistory(newUser.id, hashedPassword);
    await this.upsertMeta(this.getPasswordChangedAtKey(newUser.id), new Date().toISOString());
    await this.persistSetupPreferences(req.body);
    await this.completeSetup(req);

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

  /**
   * The wizard's platform answers, written AFTER the account exists: the account is the thing that
   * must not be lost, and a rejected timezone is not a reason to fail an initialization that already
   * created it. Only what was actually sent is stored — see InitialSetupPreferences.
   */
  /**
   * Close setup, and remember the address the operator actually used to reach it.
   *
   * The console URL is DERIVED, not invented: it is the host this very request arrived on, which the
   * operator demonstrably just used. Writing it means the gateway has a console host to route by from
   * the next request onward, which is what ends setup mode for every future boot — the marker below
   * is the belt to that braces.
   *
   * An address already configured is never overwritten: a deployment that was given one in env has
   * seeded it, and the operator's own value outranks anything derived here.
   */
  private async completeSetup(req: Request): Promise<void> {
    try {
      const existing = String((await this.manager.db.findOne(SystemConstants.TABLE.META, { key: SystemConstants.META_KEY.ADMIN_URL }))?.value ?? '').trim();
      if (!existing) {
        // What the operator CONFIRMED on the last step, which was prefilled with the address they
        // reached the wizard on. The header is the fallback for a setup posted without it — the
        // value is still derived from a request they made, never invented here.
        const confirmed = this.parseAbsoluteUrl(req.body?.adminUrl);
        const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
        const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
        const resolved = confirmed || (host ? `${proto}://${host}` : '');
        if (resolved) await this.upsertMeta(SystemConstants.META_KEY.ADMIN_URL, resolved);
      }

      await this.upsertMeta(SystemConstants.META_KEY.SETUP_COMPLETED, 'true');
      SetupMode.complete();
      // The console host just changed, so the gateway needs to hear about it now rather than at its
      // next refresh — otherwise the operator is redirected to an address that answers unknown_host.
      void new GatewayReloadClient().notify();
    } catch (error: unknown) {
      // A setup that created the admin account but could not write the marker must NOT fail: the
      // account exists, and `userCount > 0` alone keeps setup mode shut on the next boot.
      this.logger.error(`[AuthController] Could not record setup completion: ${String((error as Error)?.message ?? error)}`);
    }
  }

  /** An absolute http(s) URL, or empty. A value that will not parse is discarded, never stored. */
  private parseAbsoluteUrl(value: unknown): string {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    try {
      const url = new URL(raw);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
      return `${url.protocol}//${url.host}`;
    } catch {
      return '';
    }
  }

  private async persistSetupPreferences(body: Record<string, unknown> | undefined): Promise<void> {
    for (const [key, value] of InitialSetupPreferences.fromRequestBody(body).entries) {
      try {
        await this.upsertMeta(key, value);
      } catch (error) {
        this.logger.error(`[AuthController] Setup could not store ${key}: ${error}`);
      }
    }
  }

  /** Names the section this must not race with; how it is serialised is the driver's business. */
  private static readonly INITIAL_ADMIN_LOCK = 'fromcode.initial-admin-setup';

  /**
   * Wins the right to create the first user, exclusively.
   *
   * The check and the insert must be one indivisible step: two API replicas both seeing "no users yet"
   * would both create an administrator nobody intended. This used to hold a Postgres advisory lock
   * here, in the controller, and every other driver took an unguarded check-then-insert — so the race
   * was open on SQLite and MySQL while the comment said it was handled. The lock now belongs to the
   * database layer, which is the only place that knows how each driver serialises, and a driver with no
   * strategy refuses rather than pretending.
   */
  private async createInitialUser(email: string, password: string): Promise<any | null> {
    return this.db.withExclusiveLock(AuthControllerLifecycle.INITIAL_ADMIN_LOCK, async () => {
      if ((await this.db.count(SystemConstants.TABLE.USERS)) > 0) return null;
      return this.insertInitialUser(email, password);
    });
  }

  private async insertInitialUser(email: string, password: string): Promise<any> {
    return this.db.insert(SystemConstants.TABLE.USERS, {
      email,
      password,
      roles: ['admin'],
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
        if (status === AccountStatus.SUSPENDED) {
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

        const twoFactorMeta = await this.readMetaRow(`user:${user.id}:2fa_enabled`);

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
          let twoFactorMethod: TwoFactorMethod | null = null;

          if (hasTotpToken) {
            const secretRow = await this.readMetaRow(`user:${user.id}:totp_secret`);

            if (secretRow?.value && this.verifyTOTP(SecretService.decrypt(secretRow.value), String(totpToken).trim())) {
              twoFactorVerified = true;
              twoFactorMethod = TwoFactorMethod.TOTP;
            }
          }

          if (!twoFactorVerified && hasRecoveryCode) {
            const consumed = await this.consumeRecoveryCode(user.id, String(recoveryCode || '').trim());
            if (consumed) {
              twoFactorVerified = true;
              twoFactorMethod = TwoFactorMethod.RECOVERY;
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
          user: loginResult.user,
          // Which tenants this account may enter. Empty on a single-tenant deployment. More than
          // one means the client must ask which — the token carries no tenant until it does.
          availableTenants: loginResult.availableTenants ?? []
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
      if (err instanceof WorkspaceAccessDeniedError) {
        return res.status(403).json({ error: WorkspaceAccessDeniedError.CODE, message: err.message });
      }
      this.logger.error(`[AuthController] Login exception for ${email}: ${err}`);
      return res.status(500).json({ error: 'Internal server error during login' });
    }
  }

}
