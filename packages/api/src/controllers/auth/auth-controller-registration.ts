import { AccountStatus } from '@api/controllers/auth/enums/account-status.enum';
import { TokenErrorReason } from '@api/controllers/auth/enums/token-error-reason.enum';
/**
 * AuthControllerRegistration — abstract base with registration, email verification,
 * and frontend context helpers. Extracted from AuthControllerLifecycle (ARC-007).
 * AuthControllerLifecycle extends this class.
 */

import { Request, Response } from 'express';
import { NetworkAddressUtils, RequestSurfaceUtils, SystemConstants } from '@fromcode119/core';
import { AuthControllerTokenSupport } from '@api/controllers/auth/auth-controller-token-support';
import type { ILoginThrottleSettings } from '@api/controllers/auth/interfaces/login-throttle-settings.interface';
import type { ILoginThrottleState } from '@api/controllers/auth/interfaces/login-throttle-state.interface';
import { CoercionUtils } from '@fromcode119/core';

export abstract class AuthControllerRegistration extends AuthControllerTokenSupport {
  protected sanitizeAuthFlowContext(raw: any): Record<string, any> | undefined {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
    const input = raw as Record<string, any>;
    const output: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      const normalizedKey = String(key || '').trim();
      if (!normalizedKey) continue;
      if (value === undefined || value === null) continue;
      if (typeof value === 'string') { const trimmed = value.trim(); if (!trimmed) continue; output[normalizedKey] = trimmed; continue; }
      output[normalizedKey] = value;
    }
    return Object.keys(output).length ? output : undefined;
  }

  async register(req: Request, res: Response) {
    if (!(await this.isFrontendAuthEnabledForRequest(req))) return res.status(404).json({ error: 'Not found' });
    if (!(await this.isFrontendRegistrationEnabledForRequest(req))) return res.status(404).json({ error: 'Not found' });
    if (this.parseUserId((req as any)?.user?.id)) return res.status(409).json({ error: 'You are already signed in' });

    const { email, password, firstName, lastName, context } = req.body || {};
    const normalizedEmail = this.normalizeEmail(email);
    const flowContext = this.sanitizeAuthFlowContext(context);

    if (!normalizedEmail || !this.isValidEmail(normalizedEmail)) return res.status(400).json({ error: 'A valid email is required' });
    const passwordError = await this.validatePasswordAgainstPolicy(String(password || ''), { email: normalizedEmail });
    if (passwordError) return res.status(400).json({ error: passwordError });
    const existing = await this.db.findOne(SystemConstants.TABLE.USERS, { email: normalizedEmail });
    if (existing) return res.status(409).json({ error: 'Email is already registered' });

    const hashedPassword = await this.auth.hashPassword(String(password));
    const newUser: any = await this.db.insert(SystemConstants.TABLE.USERS, {
      email: normalizedEmail, password: hashedPassword, roles: ['customer'],
      firstName: String(firstName || '').trim() || null, lastName: String(lastName || '').trim() || null
    });

    await this.setUserAccountStatus(newUser.id, AccountStatus.ACTIVE);
    await this.setForcePasswordReset(newUser.id, false);
    await this.pushPasswordHistory(newUser.id, hashedPassword);
    await this.upsertMeta(this.getPasswordChangedAtKey(newUser.id), new Date().toISOString());
    await this.joinStorefrontSite(req, newUser.id);

    const verification = await this.issueEmailVerificationToken(newUser.id, normalizedEmail, flowContext);
    const verificationUrl = await this.buildEmailVerificationUrl(req, verification.token);
    const emailSent = await this.sendVerificationEmail({ to: normalizedEmail, verificationUrl, firstName: String(firstName || '').trim() });

    this.manager.hooks.emit('auth:user:registered', { userId: newUser.id, email: normalizedEmail, context: flowContext });
    await this.manager.writeLog('INFO', `User registered: ${normalizedEmail}`, 'system', { userId: newUser.id, email: normalizedEmail, context: flowContext, emailVerificationSent: emailSent }).catch(() => {});

    // The account exists by now whether or not the email left. Answering 500 "try again" here sent the
    // person back to a sign-up that then refused them as "already registered", with no way to get the
    // email. Report the account as created and the delivery as failed: the verification step's
    // "send again" (`resendVerification`) is the way forward, and it reports its own failures.
    const response: Record<string, any> = {
      success: true,
      requiresEmailVerification: true,
      emailDelivery: emailSent ? 'sent' : 'failed',
      message: emailSent
        ? 'Registration successful. Please verify your email before signing in.'
        : 'Registration successful, but the verification email could not be sent. Request it again.',
      user: { id: String(newUser.id), email: normalizedEmail, roles: ['customer'] },
    };
    if (process.env.NODE_ENV !== 'production') response.verificationUrl = verificationUrl;
    return res.status(201).json(response);
  }

  /**
   * The password rules this site enforces at sign-up. A form that cannot state them leaves people to
   * find each rule by being refused, so they are public wherever sign-up is.
   */
  async getPasswordPolicy(req: Request, res: Response) {
    if (!(await this.isFrontendAuthEnabledForRequest(req))) return res.status(404).json({ error: 'Not found' });
    const policy = await this.getPasswordPolicySettings();
    return res.json({
      minLength: policy.minLength,
      requireUppercase: policy.requireUppercase,
      requireLowercase: policy.requireLowercase,
      requireNumber: policy.requireNumber,
      requireSymbol: policy.requireSymbol,
      breachCheck: policy.breachCheck,
      // Always checked at sign-up (`validatePasswordAgainstPolicy`): the part of the email before the @.
      excludesEmailName: true,
    });
  }

  async verifyEmail(req: Request, res: Response) {
    // Reached from a link in an email or from the page that link opens: it works on every site, whether or
    // not the website itself offers sign-in, since the account it acts on may live in an app.
    const token = CoercionUtils.toString(req.body?.token) || CoercionUtils.toString(req.query?.token);
    if (!token) return res.status(400).json({ error: 'Verification token is required' });
    const result = await this.consumeEmailVerificationToken(token);
    if (!result.ok) return res.status(400).json({ error: result.reason === TokenErrorReason.EXPIRED ? 'Verification link has expired. Please request a new one.' : 'Invalid verification token' });
    this.manager.hooks.emit('auth:user:verified', { userId: result.userId, email: result.email, context: result.context });
    await this.manager.writeLog('INFO', `Email verified for user ${result.email}`, 'system', { userId: result.userId, email: result.email, context: result.context }).catch(() => {});
    return res.json({ success: true, message: 'Email verified successfully. You can now sign in.', user: { id: String(result.userId), email: result.email } });
  }

  async resendVerification(req: Request, res: Response) {
    // Reached from a link in an email or from the page that link opens: it works on every site, whether or
    // not the website itself offers sign-in, since the account it acts on may live in an app.
    const { captchaToken } = req.body || {};
    const email = this.normalizeEmail(req.body?.email);
    if (!email || !this.isValidEmail(email)) return res.status(400).json({ error: 'A valid email is required' });
    const throttleKey = this.getVerificationResendThrottleKey(email, NetworkAddressUtils.resolveClientIp(req) || '');
    const throttleSettings = await this.getVerificationResendThrottleSettings();
    const existingThrottleState = await this.readLoginThrottleState(throttleKey);

    if (this.isVerificationResendLocked(existingThrottleState)) {
      return res.status(429).json({
        error: 'Too many verification email requests. Please try again later.',
        lockedUntil: existingThrottleState.lockedUntil || null
      });
    }

    const throttleState = await this.recordVerificationResendAttempt(throttleKey, throttleSettings);

    if (this.isVerificationResendLocked(throttleState)) {
      return res.status(429).json({
        error: 'Too many verification email requests. Please try again later.',
        lockedUntil: throttleState.lockedUntil || null
      });
    }

    const requiresCaptcha = this.requiresVerificationResendCaptcha(throttleSettings);
    if (requiresCaptcha && !String(captchaToken || '').trim()) {
      return res.status(400).json({
        error: 'Captcha verification is required before sending another verification email.',
        requiresCaptcha: true
      });
    }

    if (String(captchaToken || '').trim()) {
      try {
        const captchaResult = await this.manager.hooks.call('auth:captcha:verify', {
          token: String(captchaToken || '').trim(),
          ip: NetworkAddressUtils.resolveClientIp(req),
          email
        }) as Record<string, unknown> | undefined;
        if (captchaResult && captchaResult.valid === false) {
          return res.status(400).json({
            error: String(captchaResult.message || 'Captcha verification failed.'),
            requiresCaptcha: true
          });
        }
      } catch (captchaError: unknown) {
        return res.status(400).json({
          error: captchaError instanceof Error ? captchaError.message : 'Captcha verification failed.',
          requiresCaptcha: true
        });
      }
    }

    const user = await this.db.findOne(SystemConstants.TABLE.USERS, { email });
    if (!user) return res.json({ success: true, message: 'If an account exists, a verification email has been sent.' });
    const verified = await this.isEmailVerified(user.id);
    if (verified) {
      return res.json({ success: true, alreadyVerified: true, message: 'Email is already verified.' });
    }
    const verification = await this.issueEmailVerificationToken(user.id, email);
    const verificationUrl = await this.buildEmailVerificationUrl(req, verification.token);
    const emailSent = await this.sendVerificationEmail({ to: email, verificationUrl, firstName: this.readUserFirstName(user) });
    if (!emailSent && process.env.NODE_ENV === 'production') return res.status(500).json({ error: 'Unable to send verification email. Please try again later.' });
    const response: Record<string, any> = { success: true, message: 'Verification email sent.' };
    if (process.env.NODE_ENV !== 'production') { response.verificationUrl = verificationUrl; response.emailDelivery = emailSent ? 'sent' : 'failed'; }
    return res.json(response);
  }

  // --- Frontend context helpers (used by subclass too) ---

  /**
   * Which surface a request comes from is only what the request SAYS it is, so every surface answers to
   * a switch the site owns: the website to the website switches, an app to the app switches. The admin
   * console alone is not gated here — its own password reset must work whatever the site offers its
   * customers, and it creates no accounts (`register` is gated by the registration switch below).
   */
  protected async isFrontendAuthEnabledForRequest(req: Request): Promise<boolean> {
    if (this.isFrontendRequestContext(req)) return this.getSettingBoolean(SystemConstants.META_KEY.FRONTEND_AUTH_ENABLED, true);
    if (RequestSurfaceUtils.isAdminRequestContext(req)) return true;
    return this.getSettingBoolean(SystemConstants.META_KEY.APP_AUTH_ENABLED, true);
  }

  /**
   * Sign-up is never open to a request just because it does not call itself the website: the website
   * follows the website switch, and every other client — whatever header it sends — the app switch.
   * The admin console creates no accounts by itself (people are invited), and an admin request takes
   * its site from the session rather than the host, so without a session it would read — and sign up
   * at — the platform: it is refused outright.
   */
  protected async isFrontendRegistrationEnabledForRequest(req: Request): Promise<boolean> {
    if (!this.isFrontendRequestContext(req) && RequestSurfaceUtils.isAdminRequestContext(req)) return false;
    const key = this.isFrontendRequestContext(req)
      ? SystemConstants.META_KEY.FRONTEND_REGISTRATION_ENABLED
      : SystemConstants.META_KEY.APP_REGISTRATION_ENABLED;
    return this.getSettingBoolean(key, true);
  }

  protected isFrontendRequestContext(req: Request): boolean {
    return RequestSurfaceUtils.isFrontendRequestContext(req);
  }

  protected async getVerificationResendThrottleSettings(): Promise<ILoginThrottleSettings> {
    return {
      threshold: 5,
      windowMinutes: 10,
      lockoutMinutes: 15,
      captchaEnabled: await this.getSettingBoolean(SystemConstants.META_KEY.AUTH_CAPTCHA_ENABLED, false),
      captchaThreshold: 1
    };
  }

  protected getVerificationResendThrottleKey(email: string, ip: string): string {
    const normalizedEmail = this.normalizeEmail(email);
    const normalizedIp = String(ip || '').trim() || 'unknown';
    return `auth:verification_resend:${this.normalizeEmail(`${normalizedEmail}|${normalizedIp}`)}`;
  }

  protected isVerificationResendLocked(state: ILoginThrottleState): boolean {
    return this.isLoginLocked(state);
  }

  protected requiresVerificationResendCaptcha(settings: ILoginThrottleSettings): boolean {
    return settings.captchaEnabled;
  }

  protected async recordVerificationResendAttempt(
    key: string,
    settings: ILoginThrottleSettings
  ): Promise<ILoginThrottleState> {
    const state = await this.readLoginThrottleState(key);
    const now = Date.now();
    const windowMs = settings.windowMinutes * 60 * 1000;
    let countAttempts = 1;

    if (state.lastFailureAt) {
      const lastAt = new Date(state.lastFailureAt).getTime();
      if (!Number.isNaN(lastAt) && now - lastAt <= windowMs) {
        countAttempts = Number(state.count || 0) + 1;
      }
    }

    const payload: ILoginThrottleState = {
      count: countAttempts,
      firstFailureAt: countAttempts === 1
        ? new Date(now).toISOString()
        : (state.firstFailureAt || new Date(now).toISOString()),
      lastFailureAt: new Date(now).toISOString()
    };

    if (countAttempts >= settings.threshold) {
      payload.lockedUntil = new Date(now + settings.lockoutMinutes * 60 * 1000).toISOString();
    }

    await this.upsertMeta(key, JSON.stringify(payload));
    return payload;
  }
}
