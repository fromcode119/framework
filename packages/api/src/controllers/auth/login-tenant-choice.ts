/**
 * Which site a successful login enters.
 *
 * Login itself is tenant-less — the account is global — so the site comes from where the login
 * arrived, in this order:
 *  1. a WORKSPACE (admin) host names its site outright; the caller has already refused an account
 *     that is not a member of it;
 *  2. a site's STOREFRONT host names that site when the account is one of its members. Before this,
 *     an account in more than one site logged in on a storefront got a session tied to NO site, the
 *     storefront refused that session on the very next request ("minted for no tenant, presented to
 *     <site>") and the customer was bounced back to the login page. An account in only one site never
 *     noticed, because rule 3 happened to pick the same site;
 *  3. an account in exactly one site enters it;
 *  4. otherwise no site — the client asks which one.
 *
 * A storefront whose site the account does not belong to changes nothing: the old rules apply, so a
 * login is never tied to a site the account has no membership in.
 */
export class LoginTenantChoice {
  static choose(input: {
    workspaceId?: string | null;
    storefrontId?: string | null;
    availableIds: readonly string[];
  }): string | undefined {
    if (input.workspaceId) return input.workspaceId;
    if (input.storefrontId && input.availableIds.includes(input.storefrontId)) return input.storefrontId;
    return input.availableIds.length === 1 ? input.availableIds[0] : undefined;
  }
}
