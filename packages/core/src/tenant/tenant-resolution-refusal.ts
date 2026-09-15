import { Enum } from '@fromcode119/react-class-components';

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
   *
   * UNKNOWN_TENANT belongs here, and leaving it out locked an operator out of their own platform.
   * The selected tenant lives in the SESSION TOKEN, so deleting the site you are currently in leaves
   * every subsequent request naming a tenant that no longer exists. That answered 403, the admin read
   * it as a dead session and signed the operator out — and signing back in was no escape, because the
   * chooser needed the same refused surface to offer anywhere else to go. Deleting one site took the
   * whole console down for the account that deleted it.
   *
   * It is the same SITUATION as NO_TENANT_SELECTED: the account is authenticated and simply has no
   * valid site selected. It stays a distinct VALUE because the two have different causes and the
   * client may want to say so — "the site you were in has been deleted" is worth telling someone —
   * but it must not be treated as a failure of authentication, which it never was.
   */
  get allowsUnauthenticatedSurface(): boolean {
    return this === TenantResolutionRefusal.UNAUTHENTICATED
      || this === TenantResolutionRefusal.NO_TENANT_SELECTED
      || this === TenantResolutionRefusal.UNKNOWN_TENANT;
  }

  /** True when the account is known and simply has no membership here. */
  get isAccessRevoked(): boolean {
    return this === TenantResolutionRefusal.TENANT_ACCESS_REVOKED;
  }
}
