import type { IAuthActivityEntry } from '@/app/users/[id]/security/interfaces/auth-activity-entry.interface';
import type { ISecurityUserRecord } from '@/app/users/[id]/security/interfaces/security-user-record.interface';
import type { IUserApiTokenRecord } from '@/app/users/[id]/security/interfaces/user-api-token-record.interface';
import type { IUserSessionRecord } from '@/app/users/[id]/security/interfaces/user-session-record.interface';
export class UserSecurityPageService {
  static buildActivityLevelClass(level: string): string {
    if (level === 'ERROR') {
      return 'bg-rose-50 border-rose-100 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-300';
    }
    if (level === 'WARN') {
      return 'bg-amber-50 border-amber-100 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-300';
    }
    return 'bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-300';
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
