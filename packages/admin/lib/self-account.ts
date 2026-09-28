import { PermissionGrants } from '@fromcode119/core/utils/permission-grants';

/**
 * A signed-in user looking at their OWN account without the permission the user-management
 * screens are built on. "View profile" sends every user to `/users/<own id>`; those screens read and
 * write through the admin user routes (`users:view` / `users:manage`), so for a staff member they
 * answered "User Not Found" and could not be saved. In self-service mode the pages use the session's
 * own identity and the account endpoints (`/auth/profile`, `/auth/security`, `/auth/2fa/*`) instead.
 */
export class SelfAccount {
  static isOwn(user: any, routeId: string): boolean {
    return Boolean(user?.id) && String(user.id) === String(routeId);
  }

  /** Own account, and the user cannot use the admin route this screen needs. */
  static isSelfService(user: any, routeId: string, permission: 'users:view' | 'users:manage'): boolean {
    if (!SelfAccount.isOwn(user, routeId)) return false;
    if (user?.roles?.includes('admin')) return false;
    const permissions: string[] = Array.isArray(user?.permissions) ? user.permissions : [];
    return !PermissionGrants.covers(permissions, permission);
  }
}
