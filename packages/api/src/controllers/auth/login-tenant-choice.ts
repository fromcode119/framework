/**
 * Which site a successful login enters.
 *
 * Login itself is tenant-less — the account is global — so the site comes from where the login
 * arrived, in this order:
 *  1. a WORKSPACE (admin) host names its site outright; the caller has already refused an account
 *     that is not a member of it;
 *  2. a site's STOREFRONT host names that site when the account may enter it — ANY membership,
 *     a customer's included. Before this the storefront was ignored and only the sites an account
 *     ADMINISTERS counted, so a customer (who administers nothing) and anyone in several sites got a
 *     session tied to NO site. The storefront refused that session on the very next request
 *     ("minted for no tenant, presented to <site>") and bounced the customer back to the login page;
 *  3. an account that administers exactly one site enters it;
 *  4. otherwise no site — the admin client asks which one.
 *
 * A storefront whose site the account may not enter changes nothing: the old rules apply, so a login
 * is never tied to a site the account has no membership in.
 */
export class LoginTenantChoice {
  static choose(input: {
    workspaceId?: string | null;
    storefrontId?: string | null;
    mayEnterStorefront: boolean;
    administeredIds: readonly string[];
  }): string | undefined {
    if (input.workspaceId) return input.workspaceId;
    if (input.storefrontId && input.mayEnterStorefront) return input.storefrontId;
    return input.administeredIds.length === 1 ? input.administeredIds[0] : undefined;
  }
}
