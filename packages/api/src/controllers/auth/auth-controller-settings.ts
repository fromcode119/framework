import { AuthControllerAccountState } from '@api/controllers/auth/auth-controller-account-state';
import { NetworkAddressUtils, PlatformSettingsService, SystemConstants, TenantMembershipService, TenantMode } from '@fromcode119/core';
import type { IPasswordPolicySettings } from '@api/controllers/auth/interfaces/password-policy-settings.interface';

/**
 * What the OPERATOR has decided, read at the moment it is needed.
 *
 * Session length and every password rule are settings, not constants, so they are read per request
 * rather than cached: a policy tightened in the admin must apply to the next login, not after a
 * restart. The numeric reader clamps to a min/max because a setting is operator input, and a session
 * length of zero or a billion is a configuration mistake, not a policy.
 */
export class AuthControllerSettings extends AuthControllerAccountState {
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

  protected async getPasswordPolicySettings(): Promise<IPasswordPolicySettings> {
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
}
