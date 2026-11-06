/**
 * The user a storefront session acts as. Signed in by the storefront's own cookie, an administrator is a
 * customer like any other: the site shows what a visitor sees, switched-off products included. Seeing
 * more is the preview, which presents the admin session instead.
 */
export class StorefrontVisitorUser {
  private static readonly ADMIN_ROLE = 'admin';

  static of<T extends { roles?: unknown; permissions?: unknown }>(user: T): T {
    const roles = Array.isArray(user.roles) ? user.roles.map(String) : [];
    if (!roles.includes(StorefrontVisitorUser.ADMIN_ROLE)) return user;
    return { ...user, roles: roles.filter((role) => role !== StorefrontVisitorUser.ADMIN_ROLE), permissions: [] };
  }
}
