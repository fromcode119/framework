/** One permission a role can be given, as the role editor and the permission list present it. */
export interface IPermissionDefinition {
  /** The exact string a gate checks, e.g. `users:manage`. */
  name: string;
  /** Short operator-facing name: "Manage users". */
  label: string;
  /** What holding it lets someone do. */
  description: string;
}
