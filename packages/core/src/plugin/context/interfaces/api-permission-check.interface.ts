/**
 * Does this set of roles grant the permission? Asked with the roles IN EFFECT for the request — on a
 * site, the membership's — never the account's global roles, which would refuse a site's own staff.
 */
export interface IApiPermissionCheck {
  (roles: string[], permission: string): Promise<boolean> | boolean;
}
