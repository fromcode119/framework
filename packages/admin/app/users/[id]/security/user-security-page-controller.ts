import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { UserSecurityPageService } from '@/app/users/[id]/security/user-security-page-service';
import type { IAuthActivityEntry } from '@/app/users/[id]/security/interfaces/auth-activity-entry.interface';
import type { ISecurityUserRecord } from '@/app/users/[id]/security/interfaces/security-user-record.interface';
import type { IUserApiTokenRecord } from '@/app/users/[id]/security/interfaces/user-api-token-record.interface';
import type { IUserSessionRecord } from '@/app/users/[id]/security/interfaces/user-session-record.interface';
import type { IUserTwoFactorSetupResponse } from '@/app/users/[id]/security/interfaces/user-two-factor-setup-response.interface';
import type { IUserTwoFactorStatusResponse } from '@/app/users/[id]/security/interfaces/user-two-factor-status-response.interface';
import type { IUserTwoFactorVerifyResponse } from '@/app/users/[id]/security/interfaces/user-two-factor-verify-response.interface';

/**
 * Data access + business logic for the user security page. Hook-free by contract: the page-client
 * class owns React state, lifecycle and notifications; this controller owns "how to fetch/do it".
 */
export class UserSecurityPageController {
  private static readonly AUTH_ACTIVITY_LIMIT = 25;
  private static readonly VERIFICATION_CODE_LENGTH = 6;

  static async fetchUser(id: string): Promise<ISecurityUserRecord> {
    return AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.USER(id)) as Promise<ISecurityUserRecord>;
  }

  static async fetchTwoFactorStatus(id: string): Promise<IUserTwoFactorStatusResponse> {
    return AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.USER_2FA_STATUS(id)) as Promise<IUserTwoFactorStatusResponse>;
  }

  /** Auth-relevant log lines for a user. An empty email has no activity by definition. */
  static async fetchAuthActivity(email: string): Promise<IAuthActivityEntry[]> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return [];

    const response = await AdminApi.get(
      `${AdminConstants.ENDPOINTS.SYSTEM.LOGS}?page=1&limit=${UserSecurityPageController.AUTH_ACTIVITY_LIMIT}&search=${encodeURIComponent(normalizedEmail)}`,
    );
    return UserSecurityPageService.filterAuthActivity(
      normalizedEmail,
      UserSecurityPageService.extractActivityEntries(response),
    );
  }

  static async fetchMySessions(): Promise<IUserSessionRecord[]> {
    const response = await AdminApi.get(AdminConstants.ENDPOINTS.AUTH.MY_SESSIONS);
    return UserSecurityPageService.extractSessions(response);
  }

  static async fetchMyApiTokens(): Promise<IUserApiTokenRecord[]> {
    const response = await AdminApi.get(AdminConstants.ENDPOINTS.AUTH.API_TOKENS);
    return UserSecurityPageService.extractApiTokens(response);
  }

  /** Mint a token. The plaintext value is returned once and never retrievable again. */
  static async createApiToken(tokenName: string, tokenDays: string): Promise<string> {
    const response = await AdminApi.post(
      AdminConstants.ENDPOINTS.AUTH.API_TOKENS,
      UserSecurityPageService.buildApiTokenPayload(tokenName, tokenDays),
    );
    return String((response as { token?: string })?.token || '');
  }

  static async revokeApiToken(tokenId: string): Promise<void> {
    await AdminApi.delete(AdminConstants.ENDPOINTS.AUTH.API_TOKEN(tokenId));
  }

  static async revokeOtherSessions(): Promise<void> {
    await AdminApi.post(AdminConstants.ENDPOINTS.AUTH.REVOKE_OTHER_SESSIONS, {});
  }

  /** Returns true when the caller just revoked the session it is running in. */
  static async revokeSession(sessionId: string): Promise<boolean> {
    const response = await AdminApi.post(AdminConstants.ENDPOINTS.AUTH.REVOKE_MY_SESSION(sessionId), {}) as {
      revokedCurrent?: boolean;
    };
    return Boolean(response.revokedCurrent);
  }

  static async disableTwoFactor(id: string): Promise<void> {
    await AdminApi.delete(AdminConstants.ENDPOINTS.SYSTEM.USER_2FA(id));
  }

  static async setupTwoFactor(id: string): Promise<IUserTwoFactorSetupResponse> {
    return AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.USER_2FA_SETUP(id), {}) as Promise<IUserTwoFactorSetupResponse>;
  }

  static async regenerateRecoveryCodes(id: string): Promise<string[]> {
    const response = await AdminApi.post(
      AdminConstants.ENDPOINTS.SYSTEM.USER_2FA_RECOVERY_REGENERATE(id), {},
    ) as IUserTwoFactorVerifyResponse;
    return Array.isArray(response.recoveryCodes) ? response.recoveryCodes : [];
  }

  static async verifyTwoFactor(id: string, token: string): Promise<string[]> {
    const response = await AdminApi.post(
      AdminConstants.ENDPOINTS.SYSTEM.USER_2FA_VERIFY(id), { token },
    ) as IUserTwoFactorVerifyResponse;
    return Array.isArray(response.recoveryCodes) ? response.recoveryCodes : [];
  }

  /** Copy the codes to the clipboard. Returns false when the browser denies access. */
  static async copyRecoveryCodes(codes: string[]): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      return true;
    } catch {
      return false;
    }
  }

  static isCompleteVerificationCode(code: string): boolean {
    return code.length === UserSecurityPageController.VERIFICATION_CODE_LENGTH;
  }

  /** The input accepts digits only — everything else is dropped as it is typed. */
  static normalizeVerificationCode(value: string): string {
    return value.replace(/\D/g, '');
  }
}
