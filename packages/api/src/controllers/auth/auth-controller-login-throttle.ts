import { AuthControllerSettings } from '@api/controllers/auth/auth-controller-settings';
import { NetworkAddressUtils, PlatformSettingsService, SystemConstants, TenantMembershipService, TenantMode } from '@fromcode119/core';
import type { ILoginThrottleSettings } from '@api/controllers/auth/interfaces/login-throttle-settings.interface';
import type { ILoginThrottleState } from '@api/controllers/auth/interfaces/login-throttle-state.interface';

/**
 * Slowing down repeated failed logins, and deciding when to demand a CAPTCHA.
 *
 * Keyed by EMAIL AND IP together: by email alone one attacker locks out a real account, by IP alone
 * a shared office NAT locks out a whole building. A second, much higher count per ADDRESS catches one
 * address trying a few passwords on many accounts, which the email + IP key never sees twice. State lives in the key/value store rather than in
 * memory, so the count survives a restart and holds across every api process.
 */
export class AuthControllerLoginThrottle extends AuthControllerSettings {
  protected async getLoginThrottleSettings(): Promise<ILoginThrottleSettings> {
    return {
      threshold: await this.getSettingNumber(SystemConstants.META_KEY.AUTH_LOCKOUT_THRESHOLD, 5, 1, 50),
      windowMinutes: await this.getSettingNumber(SystemConstants.META_KEY.AUTH_LOCKOUT_WINDOW_MINUTES, 15, 1, 1440),
      lockoutMinutes: await this.getSettingNumber(SystemConstants.META_KEY.AUTH_LOCKOUT_DURATION_MINUTES, 30, 1, 43200),
      captchaEnabled: await this.getSettingBoolean(SystemConstants.META_KEY.AUTH_CAPTCHA_ENABLED, false),
      captchaThreshold: await this.getSettingNumber(SystemConstants.META_KEY.AUTH_CAPTCHA_THRESHOLD, 3, 1, 50),
      addressThreshold: await this.getSettingNumber(SystemConstants.META_KEY.AUTH_LOCKOUT_ADDRESS_THRESHOLD, 30, 1, 1000),
      passwordResetLimit: await this.getSettingNumber(SystemConstants.META_KEY.AUTH_PASSWORD_RESET_LIMIT, 5, 1, 100),
    };
  }

  protected getLoginThrottleKey(email: string, ip: string): string {
    const normalizedEmail = this.normalizeEmail(email);
    const normalizedIp = String(ip || '').trim() || 'unknown';
    return `auth:login_throttle:${this.normalizeEmail(`${normalizedEmail}|${normalizedIp}`)}`;
  }

  protected async readLoginThrottleState(key: string): Promise<ILoginThrottleState> {
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

  protected isLoginLocked(state: ILoginThrottleState): boolean {
    if (!state?.lockedUntil) return false;
    const lockUntil = new Date(state.lockedUntil).getTime();
    if (Number.isNaN(lockUntil)) return false;
    return lockUntil > Date.now();
  }

  protected requiresCaptcha(state: ILoginThrottleState, settings: ILoginThrottleSettings): boolean {
    if (!settings.captchaEnabled) return false;
    return Number(state?.count || 0) >= settings.captchaThreshold;
  }

  /** The per-address count; '' when the address is unknown — one shared "unknown" bucket would lock everyone out. */
  protected getAddressThrottleKey(ip: string): string {
    const normalizedIp = String(ip || '').trim();
    return normalizedIp ? `auth:login_address_throttle:${normalizedIp.toLowerCase()}` : '';
  }

  protected async recordLoginFailure(key: string, settings: ILoginThrottleSettings, addressKey = '') {
    await this.countAttempt(key, settings.threshold, settings);
    if (addressKey && settings.addressThreshold) await this.countAttempt(addressKey, settings.addressThreshold, settings);
  }

  /** One more attempt under `key`, locking it once `threshold` attempts fall inside the window. */
  protected async countAttempt(key: string, threshold: number, settings: ILoginThrottleSettings): Promise<ILoginThrottleState> {
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
    const payload: ILoginThrottleState = { count: countFailures, firstFailureAt, lastFailureAt };

    if (countFailures >= threshold) {
      payload.lockedUntil = new Date(now + settings.lockoutMinutes * 60 * 1000).toISOString();
    }

    await this.upsertMeta(key, JSON.stringify(payload));
    return payload;
  }

  /**
   * Counts this request against the account and the address (Settings → Security → Password reset emails)
   * and says whether either is over the limit. Counted before the account is looked up, so an address
   * that does not exist uses up the same allowance as one that does.
   */
  protected async passwordResetLimitReached(email: string, ip: string): Promise<boolean> {
    const settings = await this.getLoginThrottleSettings();
    const limit = settings.passwordResetLimit ?? 0;
    if (!limit) return false;
    const keys = [`auth:password_reset_request:${email}`];
    if (ip.trim()) keys.push(`auth:password_reset_request_address:${ip.trim().toLowerCase()}`);
    let reached = false;
    for (const key of keys) {
      const before = await this.readLoginThrottleState(key);
      if (this.isLoginLocked(before)) { reached = true; continue; }
      const after = await this.countAttempt(key, limit + 1, settings);
      if (this.isLoginLocked(after)) reached = true;
    }
    return reached;
  }

  protected async clearLoginThrottleState(key: string) {
    await this.deleteMeta(key);
  }
}
