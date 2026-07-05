/**
 * Canonical access levels a plugin API route may declare. Use `AccessLevel.Public` instead of magic
 * strings. Undeclared route access ⇒ admin-only (fail-closed). See {@link ApiAccessGate}.
 */
export enum AccessLevel {
  Public = 'public',
  Authenticated = 'authenticated',
  Self = 'self',
  Admin = 'admin',
}
