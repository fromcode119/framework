/**
 * The authenticated admin user. Shape verified against BOTH writers of the `AUTH_USER` cookie
 * (see `AuthProviderView`), not inferred:
 *
 *   POST /auth/login  → { id: string,  email, firstName, lastName, roles[], permissions[], jti }
 *   GET  /auth/security → { id: number, email, firstName, lastName, roles[], permissions[] }
 *
 * Hence `id` is `string | number` — the two endpoints genuinely disagree. Never widen this by
 * guessing; re-check against the live endpoints.
 */
export interface IUser {
  id: string | number;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  /**
   * Effective permissions, baked into BOTH payloads so the client can decide console entry and
   * permission-scoped nav without a round-trip. Admins get `['*']`. This is what feeds the secondary
   * panel's `requiredCapabilities` filter — keep the two payloads in sync or that nav silently breaks.
   */
  permissions: string[];
  /** Login payload only — the session's JWT id. */
  jti?: string;
  /**
   * May this account act on the PLATFORM — the container every site runs on? False for a tenant's
   * own admin on a multi-tenant deployment; true for every admin on a single-tenant one. Drives
   * whether install/delete/activate controls are rendered at all (see `PlatformAccess`).
   */
  platformAdmin?: boolean;
  /** Administers at least one site. What the admin's door checks when the global role is not `admin`. */
  siteAdmin?: boolean;
  /** Is this a multi-tenant deployment? When false, `admin` IS the platform and nothing is hidden. */
  multiTenant?: boolean;
}
