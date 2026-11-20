import type { IAuthActivityEntry } from '@/app/users/[id]/security/interfaces/auth-activity-entry.interface';
import type { ISecurityUserRecord } from '@/app/users/[id]/security/interfaces/security-user-record.interface';
import type { IUserApiTokenRecord } from '@/app/users/[id]/security/interfaces/user-api-token-record.interface';
import type { IUserSessionRecord } from '@/app/users/[id]/security/interfaces/user-session-record.interface';
export class UserSecurityPageService {
  /**
   * The browser and system a session was signed in from, read from its user agent ("Chrome · macOS");
   * '' when the agent names neither, so the row falls back to its generic name.
   */
  static describeDevice(userAgent: string | undefined): string {
    const agent = String(userAgent || '');
    const browser = [['Edg/', 'Edge'], ['OPR/', 'Opera'], ['Firefox/', 'Firefox'], ['Chrome/', 'Chrome'], ['Safari/', 'Safari']]
      .find(([token]) => agent.includes(token))?.[1] || '';
    const system = [['iPhone', 'iOS'], ['iPad', 'iPadOS'], ['Android', 'Android'], ['Windows', 'Windows'], ['Mac OS X', 'macOS'], ['Linux', 'Linux']]
      .find(([token]) => agent.includes(token))?.[1] || '';
    return [browser, system].filter(Boolean).join(' · ');
  }

  static buildApiTokenPayload(tokenName: string, tokenDays: string): { expiresInDays?: number; name: string } {
    const expiresInDays = Number.parseInt(tokenDays.trim(), 10);
    return Number.isNaN(expiresInDays) ? { name: tokenName.trim() } : { expiresInDays, name: tokenName.trim() };
  }

  static extractActivityEntries(response: unknown): IAuthActivityEntry[] {
    const value = response as { docs?: IAuthActivityEntry[] } | IAuthActivityEntry[] | null;
    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value.docs)) return value.docs;
    return [];
  }

  static extractApiTokens(response: unknown): IUserApiTokenRecord[] {
    const value = response as { docs?: IUserApiTokenRecord[] } | null;
    return Array.isArray(value?.docs) ? value.docs : [];
  }

  static extractSessions(response: unknown): IUserSessionRecord[] {
    const value = response as { docs?: IUserSessionRecord[] } | null;
    return Array.isArray(value?.docs) ? value.docs : [];
  }

  static filterAuthActivity(email: string, entries: IAuthActivityEntry[]): IAuthActivityEntry[] {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return [];

    return entries.filter((entry) => {
      const message = String(entry.message || '').toLowerCase();
      const contextEmail = String(entry.context?.email || entry.email || '').toLowerCase();
      const combined = `${message} ${contextEmail}`;
      return combined.includes(normalizedEmail) && (
        combined.includes('login') ||
        combined.includes('logout') ||
        combined.includes('2fa') ||
        combined.includes('session') ||
        combined.includes('registered')
      );
    });
  }

  static isAdministrator(user: ISecurityUserRecord | null): boolean {
    return Array.isArray(user?.roles) && user.roles.includes('admin');
  }

  static isSameUser(authUserId: number | string | undefined, targetUserId: string): boolean {
    return String(authUserId || '') === String(targetUserId || '');
  }
}
