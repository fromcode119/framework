/**
 * Does a set of granted permissions cover a required one? `*` covers everything, an exact match
 * covers itself, and `<prefix>:*` covers `<prefix>:anything`.
 *
 * One rule, stated once: the host's permission checker, the sandboxed plugin's `requirePermission`
 * and the admin's menu all answer this question, and a copy that forgets the wildcard refuses a user
 * the others let through.
 */
export class PermissionGrants {
  static covers(granted: readonly string[], required: string): boolean {
    if (granted.includes('*') || granted.includes(required)) return true;
    return granted.some((permission) => permission.endsWith(':*') && required.startsWith(permission.slice(0, -1)));
  }
}
