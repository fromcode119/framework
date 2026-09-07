/**
 * A login the application connects with: the name and password a connection string already carries.
 *
 * Deliberately not read from separate environment variables. The role name and password exist inside
 * `DATABASE_URL` and `DATABASE_MIGRATION_URL` already, and a second copy of them elsewhere can only ever
 * disagree with the connection that is actually used.
 */
export class DatabaseRole {
  constructor(
    readonly name: string,
    readonly password: string,
  ) {}

  /** The role a connection string logs in as, or `null` when it names none. */
  static fromConnectionUrl(url: string): DatabaseRole | null {
    try {
      const parsed = new URL(String(url ?? ''));
      const name = decodeURIComponent(parsed.username || '');
      if (!name) return null;
      return new DatabaseRole(name, decodeURIComponent(parsed.password || ''));
    } catch {
      return null;
    }
  }
}
