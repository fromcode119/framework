import { Enum } from '@fromcode119/reactor';

/**
 * Why admin tenancy could not put a request in a tenant.
 *
 * These are four DIFFERENT answers and the client acts differently on each, which is the whole reason
 * they are not one flag: "you have not picked a site yet" is a prompt, "your access was revoked" means
 * re-authenticate or ask for membership, and neither is "this domain does not exist". They were loose
 * string literals compared by `===` in one file and re-emitted as the `error` field in another — a
 * closed set with no name, so nothing could enumerate it and a typo on either side would simply have
 * fallen through to the 403.
 *
 * The `value` IS the wire contract: it is what `res.json({ error })` sends and what the admin reads,
 * so these strings must not change without changing the clients that switch on them.
 */
export class TenantResolutionRefusal extends Enum {
  /** No session token, or one that does not verify. Not an error — the login route needs to be reachable. */
  static readonly UNAUTHENTICATED = new TenantResolutionRefusal('unauthenticated');

  /** Signed in, reaches more than one site and has entered none. The site chooser answers this. */
  static readonly NO_TENANT_SELECTED = new TenantResolutionRefusal('no_tenant_selected');

  /** Signed in, but not a member of the tenant this request would act in. */
  static readonly TENANT_ACCESS_REVOKED = new TenantResolutionRefusal('tenant_access_revoked');

  /** The session names a tenant that no longer exists. */
  static readonly UNKNOWN_TENANT = new TenantResolutionRefusal('unknown_tenant');

  private constructor(value: string) {
    super(value);
  }

  /**
   * True while the visitor may still reach the unauthenticated surface (login, the site chooser) —
   * so the request continues WITHOUT a tenant instead of being refused outright. Asked as a question
   * about the refusal rather than as an `||` chain at the call site, so a new refusal has to decide
   * this for itself instead of silently defaulting to a 403.
   */
  get allowsUnauthenticatedSurface(): boolean {
    return this === TenantResolutionRefusal.UNAUTHENTICATED || this === TenantResolutionRefusal.NO_TENANT_SELECTED;
  }

  /** True when the account is known and simply has no membership here. */
  get isAccessRevoked(): boolean {
    return this === TenantResolutionRefusal.TENANT_ACCESS_REVOKED;
  }
}
