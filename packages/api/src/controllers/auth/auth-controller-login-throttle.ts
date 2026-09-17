import { AuthControllerSettings } from '@api/controllers/auth/auth-controller-settings';
import { NetworkAddressUtils, PlatformSettingsService, SystemConstants, TenantMembershipService, TenantMode } from '@fromcode119/core';
import type { ILoginThrottleSettings } from '@api/controllers/auth/interfaces/login-throttle-settings.interface';
import type { ILoginThrottleState } from '@api/controllers/auth/interfaces/login-throttle-state.interface';

/**
 * Slowing down repeated failed logins, and deciding when to demand a CAPTCHA.
 *
 * Keyed by EMAIL AND IP together: by email alone one attacker locks out a real account, by IP alone
 * a shared office NAT locks out a whole building. State lives in the key/value store rather than in
 * memory, so the count survives a restart and holds across every api process.
 */
export class AuthControllerLoginThrottle extends AuthControllerSettings {
  protected async getLoginThrottleSettings(): Promise<ILoginThrottleSettings> {
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

  protected async recordLoginFailure(key: string, settings: ILoginThrottleSettings) {
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

    if (countFailures >= settings.threshold) {
      payload.lockedUntil = new Date(now + settings.lockoutMinutes * 60 * 1000).toISOString();
    }

    await this.upsertMeta(key, JSON.stringify(payload));
  }

  protected async clearLoginThrottleState(key: string) {
    await this.deleteMeta(key);
  }
}
