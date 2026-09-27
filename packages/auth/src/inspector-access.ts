import { RouteConstants } from '@fromcode119/core';

/**
 * The read-only INSPECTOR: an account that sees what an administrator sees and can change nothing — the
 * access a tax inspector is owed on request (Bulgaria, Ordinance N-18 art. 52s(3): full access to the
 * admin panel, its settings and its reports). The operator switches it on by giving an account the
 * `inspector` role, and off by taking it away.
 *
 * Enforced in ONE place, the request gate, for every route — core, collections, plugins, and isolated
 * plugins, which receive the principal the gate built:
 * - a READ (GET/HEAD/OPTIONS) runs as an administrator's, marked `readOnly`, so every existing guard
 *   admits it without knowing inspectors exist;
 * - anything else is refused before routing, except signing in and out, choosing a site, and the
 *   second sign-in factor.
 *
 * The inspector's stored roles never contain `admin`: the session token carries `inspector` only, so a
 * write can never borrow the read grant. Two reads stay refused because they hand out more than the
 * admin panel shows: a full backup archive, and a plugin's settings export (which may carry secrets).
 */
export class InspectorAccess {
  static readonly ROLE = 'inspector';
  private static readonly ADMIN_ROLE = 'admin';
  private static readonly READS = new Set(['GET', 'HEAD', 'OPTIONS']);
  private static readonly AUTH = RouteConstants.SEGMENTS.AUTH;
  private static readonly WRITES_ALLOWED = [
    RouteConstants.SEGMENTS.LOGIN,
    RouteConstants.SEGMENTS.LOGOUT,
    RouteConstants.SEGMENTS.SSO_LOGIN,
    RouteConstants.SEGMENTS.TENANTS_SELECT,
    RouteConstants.SEGMENTS.TWO_FACTOR_VERIFY,
  ].map((segment) => `${InspectorAccess.AUTH}${segment}`);
  private static readonly READS_REFUSED = [/\/admin\/backups\/[^/]+\/download$/, /\/settings\/export$/];

  /** An inspector who is not also an administrator. */
  static isInspector(user: { roles?: unknown } | null | undefined): boolean {
    const roles = Array.isArray(user?.roles) ? user!.roles as string[] : [];
    return roles.includes(InspectorAccess.ROLE) && !roles.includes(InspectorAccess.ADMIN_ROLE);
  }

  /**
   * Applies the rule to an authenticated request. Returns the refusal to send, or null to go on (the
   * principal of an allowed read is then the read-only administrator view).
   */
  static apply(req: any): { status: number; body: Record<string, string> } | null {
    if (!InspectorAccess.isInspector(req.user)) return null;
    const method = String(req.method || 'GET').toUpperCase();
    const path = String(req.path || req.url || '').split('?')[0].replace(/\/+$/, '');
    if (InspectorAccess.READS.has(method)) {
      if (InspectorAccess.READS_REFUSED.some((pattern) => pattern.test(path))) return InspectorAccess.refusal();
      req.user = { ...req.user, roles: [...req.user.roles, InspectorAccess.ADMIN_ROLE], readOnly: true };
      return null;
    }
    return InspectorAccess.WRITES_ALLOWED.some((allowed) => path.endsWith(allowed)) ? null : InspectorAccess.refusal();
  }

  /**
   * What the admin client is told about an inspector: the administrator's screens, marked read-only.
   * For the response only — never pass the result to token signing.
   */
  static presentToAdmin<T extends { roles?: unknown; permissions?: unknown }>(user: T): T & { readOnly?: boolean } {
    if (!InspectorAccess.isInspector(user)) return user;
    const roles = user.roles as string[];
    return { ...user, roles: [...roles, InspectorAccess.ADMIN_ROLE], permissions: ['*'], readOnly: true };
  }

  private static refusal(): { status: number; body: Record<string, string> } {
    return { status: 403, body: { error: 'read_only_inspector', message: 'This account can look but not change anything: it has read-only inspector access.' } };
  }
}
