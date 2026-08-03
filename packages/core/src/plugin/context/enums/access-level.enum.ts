import { Enum } from '@fromcode119/reactor';

/**
 * Canonical access levels a plugin API route may declare, e.g.
 * `context.api.get('/x', { access: AccessLevel.PUBLIC }, handler)`.
 *
 *   - `PUBLIC`        — no auth
 *   - `AUTHENTICATED` — any logged-in user
 *   - `SELF`          — logged-in user; row-scoping to their own records is the handler's job
 *   - `ADMIN`         — admin role
 *
 * A route that declares NOTHING is admin-only (fail-closed). For a specific permission instead of a
 * coarse level, declare an {@link ApiPermissionRequirement}. See {@link ApiAccessGate}.
 *
 * A reactor `Enum`, not a plain TS `enum`: members are singletons, so `level === AccessLevel.PUBLIC`
 * is an identity check. Comparing a member to a RAW string is always false — cross a string boundary
 * (a `roles: string[]`, a DB column) via `.value`.
 */
export class AccessLevel extends Enum {
  static readonly PUBLIC = new AccessLevel('public');
  static readonly AUTHENTICATED = new AccessLevel('authenticated');
  static readonly SELF = new AccessLevel('self');
  static readonly ADMIN = new AccessLevel('admin');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; defaults to the fail-closed ADMIN. */
  static resolve(value: unknown): AccessLevel {
    if (value instanceof AccessLevel) return value;
    const found = AccessLevel.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as AccessLevel | undefined) ?? AccessLevel.ADMIN;
  }
}
