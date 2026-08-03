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
}
