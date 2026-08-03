/**
 * The `context.users` surface of {@link PluginContext}.
 *
 * Extracted from an anonymous inline object type: a plugin-facing CONTRACT deserves a name it can be
 * referenced by, and 25 of these inline in one class put the file at 366 lines.
 */
export interface IPluginContextUsers {
  findAdmins(options?: { limit?: number }): Promise<Array<{ id: any; email: string; roles: string[] }>>;
  findByRole(role: string, options?: { limit?: number }): Promise<Array<{ id: any; email: string; roles: string[] }>>;
  findById(id: any): Promise<{ id: any; email: string; username: string; firstName: string; lastName: string; roles: string[] } | null>;
  findByEmail(email: string): Promise<{ id: any; email: string; username: string; firstName: string; lastName: string; roles: string[] } | null>;
  /** List users (safe profiles, newest first). */
  list(options?: { limit?: number }): Promise<Array<{ id: any; email: string; username: string; firstName: string; lastName: string; roles: string[] }>>;
  /** Create a user (idempotent on email). Pass an ALREADY-HASHED password (context.auth.hashPassword). */
  create(input: { email: string; password: string; roles?: string[]; firstName?: string; lastName?: string }): Promise<{ id: any } | null>;
}
