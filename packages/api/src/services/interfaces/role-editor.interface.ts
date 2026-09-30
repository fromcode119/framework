/** Who is editing roles (see RoleManagementService). */
export interface IRoleEditor {
  /** Whether the account is the platform admin — the only one who may define PLATFORM roles. */
  platformAdmin: boolean;
}
