/**
 * The user a storefront session acts as. Signed in by the storefront's own cookie, an administrator is a
 * customer like any other: the site shows what a visitor sees, switched-off products included.
 *
 * Seeing more is the preview (`?preview=1`). The page itself is rendered with the admin session; the
 * READ requests (GET/HEAD) that page makes from the browser carry it in their same-origin `Referer`,
 * so they keep the administrator too. Otherwise the previewed product rendered and then read "not
 * found" once the browser asked for it. A forged `Referer` only ever returns a signed-in user's OWN
 * rights, and never for a write.
 */
export class StorefrontVisitorUser {
  private static readonly ADMIN_ROLE = 'admin';
  /** A preview only reads: a write from a storefront session is a visitor's, whatever page sent it. */
  private static readonly READ_METHODS = ['GET', 'HEAD'];

  static of<T extends { roles?: unknown; permissions?: unknown }>(user: T, req?: { method?: string; headers?: Record<string, unknown> }): T {
    const roles = Array.isArray(user.roles) ? user.roles.map(String) : [];
    if (!roles.includes(StorefrontVisitorUser.ADMIN_ROLE) || StorefrontVisitorUser.fromPreviewPage(req)) return user;
    return { ...user, roles: roles.filter((role) => role !== StorefrontVisitorUser.ADMIN_ROLE), permissions: [] };
  }

  /** The request came from a page of this same host opened with `?preview=1`. */
  private static fromPreviewPage(req?: { method?: string; headers?: Record<string, unknown> }): boolean {
    if (!StorefrontVisitorUser.READ_METHODS.includes(String(req?.method ?? '').toUpperCase())) return false;
    const referer = String(req?.headers?.referer ?? '');
    const host = String(req?.headers?.['x-forwarded-host'] ?? req?.headers?.host ?? '').split(',')[0].trim();
    if (!referer || !host) return false;
    try {
      const page = new URL(referer);
      return page.host === host && page.searchParams.get('preview') === '1';
    } catch {
      return false;
    }
  }
}
