/**
 * What a driver did when asked to provision logins.
 *
 * Not every database HAS logins — SQLite's boundary is the file's permissions — so "did nothing" is a
 * legitimate answer here and is reported rather than thrown. That differs on purpose from
 * `withExclusiveLock`, which refuses: running unserialised would permit the very race the caller asked
 * to be protected from, whereas a database with no role system is simply a deployment where the
 * question does not arise.
 */
export class DatabaseRoleOutcome {
  private constructor(
    readonly supported: boolean,
    readonly roles: readonly string[],
    readonly reason: string,
  ) {}

  /** `note`: what was applied with a reservation — objects left out, and why. Empty when none. */
  static applied(roles: readonly string[], note = ''): DatabaseRoleOutcome {
    return new DatabaseRoleOutcome(true, roles, note);
  }

  static unsupported(reason: string): DatabaseRoleOutcome {
    return new DatabaseRoleOutcome(false, [], reason);
  }
}
