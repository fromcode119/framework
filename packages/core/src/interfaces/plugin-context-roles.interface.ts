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
}
