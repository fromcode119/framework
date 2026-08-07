/**
 * The `context.roles` surface of {@link PluginContext}.
 *
 * Extracted from an anonymous inline object type: a plugin-facing CONTRACT deserves a name it can be
 * referenced by, and 25 of these inline in one class put the file at 366 lines.
 */
export interface IPluginContextRoles {
  ensure(slug: string, data: { name: string; description?: string; type?: string; permissions?: any[] }): Promise<void>;
  /** Grant a role to a user (idempotent). */
  assignRole(userId: number | string, slug: string): Promise<void>;
  /** Revoke a role from a user (no-op if not assigned). */
  removeRole(userId: number | string, slug: string): Promise<void>;
  /** List the user ids that currently hold a given role. */
  listUserIdsWithRole(slug: string): Promise<number[]>;
  /**
   * The EMAIL addresses of the users holding a role (deduped, lowercased).
   *
   * This is the method CLAUDE.md points plugins at for admin-notification recipients, and it was
   * IMPLEMENTED but missing from this contract — so a plugin author who typed `context.roles.` never
   * saw it and fell back to `context.users.findAdmins()`, which reads only the JSON `roles` column and
   * stops at the 200 newest users. The failure mode is silent: a plausible, non-empty, SHORTER
   * recipient list. This method unions the `users_roles` junction with the JSON column over the full
   * user set, and the framework owns that system-table join so plugins never read `users` directly.
   */
  listUserEmailsWithRole(slug: string): Promise<string[]>;
}
