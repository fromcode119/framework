import { Request, Response } from 'express';
import { CookieConstants, SystemConstants } from '@fromcode119/core';
import { randomUUID } from 'crypto';
import { AuthControllerInfrastructure } from './auth-controller-infrastructure';
import type { AccountStatus } from './auth-controller.types';
import type {
  PasswordPolicySettings,
  LoginThrottleSettings,
  LoginThrottleState
} from './auth-controller.interfaces';

export class AuthControllerPolicy extends AuthControllerInfrastructure {
  protected async issueLoginSession(req: Request, res: Response, user: any) {
    const roles = this.readRoles(user);
    const jti = randomUUID();
    const userResponse = {
      id: String(user.id),
      email: this.normalizeEmail(user.email),
      firstName: this.readUserFirstName(user),
      lastName: this.readUserLastName(user),
      roles,
      jti,
    };
    const sessionDurationMinutes = await this.getSessionDurationMinutes();
    const maxAgeMs = sessionDurationMinutes * 60 * 1000;
    const token = await this.auth.generateToken(userResponse, { expiresIn: `${sessionDurationMinutes}m` });
    const expiresAt = new Date(Date.now() + maxAgeMs);
    const sessionId = randomUUID();

    await this.db.insert(SystemConstants.TABLE.SESSIONS, {
      id: sessionId,
      userId: user.id,
      tokenId: jti,
      expiresAt,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip
    });

    const cookieOptions = this.getCookieOptions(req, false, maxAgeMs);
    const sessionCookieName = this.getSessionCookieName(req);

    this.clearConflictingSessionCookies(req, res);
    res.cookie(sessionCookieName, token, cookieOptions);

    return { token, user: userResponse };
  }

  protected async getSessionDurationMinutes(): Promise<number> {
    try {
      const row = await this.readMetaRow(SystemConstants.META_KEY.AUTH_SESSION_DURATION);
      const parsed = Number.parseInt(String(row?.value || this.defaultSessionDurationMinutes), 10);
      if (Number.isNaN(parsed)) return this.defaultSessionDurationMinutes;
      return Math.min(this.maxSessionDurationMinutes, Math.max(this.minSessionDurationMinutes, parsed));
    } catch {
      return this.defaultSessionDurationMinutes;
    }
  }

  protected async getSettingNumber(key: string, defaultValue: number, min: number, max: number): Promise<number> {
    const value = Number.parseInt(String((await this.getMetaValue(key)) || defaultValue), 10);
    if (Number.isNaN(value)) return defaultValue;
    return Math.min(max, Math.max(min, value));
  }

  protected async getSettingBoolean(key: string, defaultValue: boolean): Promise<boolean> {
    const value = await this.getMetaValue(key);
    if (value === null) return defaultValue;
    return String(value).trim().toLowerCase() === 'true';
  }

  protected async getPasswordPolicySettings(): Promise<PasswordPolicySettings> {
    return {
      minLength: await this.getSettingNumber(SystemConstants.META_KEY.AUTH_PASSWORD_MIN_LENGTH, 8, 8, 128),
      requireUppercase: await this.getSettingBoolean(SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_UPPERCASE, true),
      requireLowercase: await this.getSettingBoolean(SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_LOWERCASE, true),
      requireNumber: await this.getSettingBoolean(SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_NUMBER, true),
      requireSymbol: await this.getSettingBoolean(SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_SYMBOL, false),
      historyCount: await this.getSettingNumber(SystemConstants.META_KEY.AUTH_PASSWORD_HISTORY, 5, 0, 20),
      breachCheck: await this.getSettingBoolean(SystemConstants.META_KEY.AUTH_PASSWORD_BREACH_CHECK, false)
    };
  }

  protected async validatePasswordAgainstPolicy(
    password: string,
    options: { userId?: number; email?: string; currentPasswordHash?: string } = {}
  ): Promise<string | null> {
    const value = String(password || '');
    const policy = await this.getPasswordPolicySettings();

    if (value.length < policy.minLength) {
      return `Password must be at least ${policy.minLength} characters.`;
    }
    if (policy.requireUppercase && !/[A-Z]/.test(value)) {
      return 'Password must include at least one uppercase letter.';
    }
    if (policy.requireLowercase && !/[a-z]/.test(value)) {
      return 'Password must include at least one lowercase letter.';
    }
    if (policy.requireNumber && !/[0-9]/.test(value)) {
      return 'Password must include at least one number.';
    }
    if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(value)) {
      return 'Password must include at least one symbol.';
    }

    const normalizedEmail = this.normalizeEmail(options.email || '');
    if (normalizedEmail && value.toLowerCase().includes(normalizedEmail.split('@')[0])) {
      return 'Password must not include your email username.';
    }

    if (options.currentPasswordHash) {
      const matchesCurrent = await this.auth.comparePassword(value, options.currentPasswordHash);
      if (matchesCurrent) return 'New password must be different from your current password.';
    }

    if (options.userId && policy.historyCount > 0) {
      const history = await this.readPasswordHistory(options.userId);
      const recent = history.slice(0, policy.historyCount);
      for (const hash of recent) {
        const matches = await this.auth.comparePassword(value, hash);
        if (matches) return `Password must not match your last ${policy.historyCount} password(s).`;
      }
    }

    if (policy.breachCheck) {
      try {
        const breachResult: any = await this.manager.hooks.call('auth:password:breach-check', {
          password: value,
          email: normalizedEmail || undefined
        });
        if (breachResult?.compromised === true) {
          return 'This password appears in known data breaches. Choose a different password.';
        }
      } catch {
        // Ignore optional breach check provider failures.
      }
    }

    return null;
  }

  protected async getLoginThrottleSettings(): Promise<LoginThrottleSettings> {
    return {
      threshold: await this.getSettingNumber(SystemConstants.META_KEY.AUTH_LOCKOUT_THRESHOLD, 5, 1, 50),
      windowMinutes: await this.getSettingNumber(SystemConstants.META_KEY.AUTH_LOCKOUT_WINDOW_MINUTES, 15, 1, 1440),
      lockoutMinutes: await this.getSettingNumber(SystemConstants.META_KEY.AUTH_LOCKOUT_DURATION_MINUTES, 30, 1, 43200),
      captchaEnabled: await this.getSettingBoolean(SystemConstants.META_KEY.AUTH_CAPTCHA_ENABLED, false),
      captchaThreshold: await this.getSettingNumber(SystemConstants.META_KEY.AUTH_CAPTCHA_THRESHOLD, 3, 1, 50)
    };
  }

  protected getLoginThrottleKey(email: string, ip: string): string {
    const normalizedEmail = this.normalizeEmail(email);
    const normalizedIp = String(ip || '').trim() || 'unknown';
    return `auth:login_throttle:${this.normalizeEmail(`${normalizedEmail}|${normalizedIp}`)}`;
  }

  protected async readLoginThrottleState(key: string): Promise<LoginThrottleState> {
    const row = await this.readMetaRow(key);
    if (!row?.value) return { count: 0 };
    try {
      const parsed = JSON.parse(String(row.value));
      return {
        count: Number(parsed?.count || 0),
        firstFailureAt: parsed?.firstFailureAt ? String(parsed.firstFailureAt) : undefined,
        lastFailureAt: parsed?.lastFailureAt ? String(parsed.lastFailureAt) : undefined,
        lockedUntil: parsed?.lockedUntil ? String(parsed.lockedUntil) : undefined
      };
    } catch {
      return { count: 0 };
    }
  }

  protected isLoginLocked(state: LoginThrottleState): boolean {
    if (!state?.lockedUntil) return false;
    const lockUntil = new Date(state.lockedUntil).getTime();
    if (Number.isNaN(lockUntil)) return false;
    return lockUntil > Date.now();
  }

  protected requiresCaptcha(state: LoginThrottleState, settings: LoginThrottleSettings): boolean {
    if (!settings.captchaEnabled) return false;
    return Number(state?.count || 0) >= settings.captchaThreshold;
  }

  protected async recordLoginFailure(key: string, settings: LoginThrottleSettings) {
    const state = await this.readLoginThrottleState(key);
    const now = Date.now();
    const windowMs = settings.windowMinutes * 60 * 1000;

    let countFailures = 1;
    if (state.lastFailureAt) {
      const lastAt = new Date(state.lastFailureAt).getTime();
      if (!Number.isNaN(lastAt) && now - lastAt <= windowMs) {
        countFailures = Number(state.count || 0) + 1;
      }
    }

    const firstFailureAt = countFailures === 1 ? new Date(now).toISOString() : (state.firstFailureAt || new Date(now).toISOString());
    const lastFailureAt = new Date(now).toISOString();
    const payload: LoginThrottleState = { count: countFailures, firstFailureAt, lastFailureAt };

    if (countFailures >= settings.threshold) {
      payload.lockedUntil = new Date(now + settings.lockoutMinutes * 60 * 1000).toISOString();
    }

    await this.upsertMeta(key, JSON.stringify(payload));
  }

  protected async clearLoginThrottleState(key: string) {
    await this.deleteMeta(key);
  }

  protected getPasswordHistoryKey(userId: number) {
    return `user:${userId}:password_history`;
  }

  protected getPasswordChangedAtKey(userId: number) {
    return `user:${userId}:password_changed_at`;
  }

  protected async readPasswordHistory(userId: number): Promise<string[]> {
    const row = await this.readMetaRow(this.getPasswordHistoryKey(userId));
    if (!row?.value) return [];
    try {
      const parsed = JSON.parse(String(row.value));
      if (!Array.isArray(parsed)) return [];
      return parsed.map((entry: any) => String(entry || '')).filter(Boolean);
    } catch {
      return [];
    }
  }

  protected async pushPasswordHistory(userId: number, hash: string) {
    const history = await this.readPasswordHistory(userId);
    const next = [String(hash), ...history.filter((entry) => String(entry) !== String(hash))];
    await this.upsertMeta(this.getPasswordHistoryKey(userId), JSON.stringify(next.slice(0, 25)));
  }

  protected getUserAccountStatusKey(userId: number) {
    return `user:${userId}:account_status`;
  }

  protected getForcePasswordResetKey(userId: number) {
    return `user:${userId}:force_password_reset`;
  }

  protected async setUserAccountStatus(userId: number, status: AccountStatus) {
    await this.upsertMeta(this.getUserAccountStatusKey(userId), status);
  }

  protected async getUserAccountStatus(userId: number): Promise<AccountStatus> {
    const row = await this.readMetaRow(this.getUserAccountStatusKey(userId));
    const value = String(row?.value || '').trim().toLowerCase();
    if (value === 'suspended') return 'suspended';
    return 'active';
  }

  protected async setForcePasswordReset(userId: number, enabled: boolean) {
    await this.upsertMeta(this.getForcePasswordResetKey(userId), enabled ? 'true' : 'false');
  }

  protected async getForcePasswordReset(userId: number): Promise<boolean> {
    const row = await this.readMetaRow(this.getForcePasswordResetKey(userId));
    return String(row?.value || '').trim().toLowerCase() === 'true';
  }
}
