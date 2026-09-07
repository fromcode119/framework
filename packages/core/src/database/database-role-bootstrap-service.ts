import { DatabaseRole, DatabaseRolePlan, DatabaseConnectionUrls } from '@fromcode119/database';
import type { DatabaseRoleOutcome } from '@fromcode119/database';
import { Logger } from '@core/logging';

/**
 * Creates the logins the application runs as, using a privileged connection that the application itself
 * never holds.
 *
 * This used to be a shell script mounted into the database image's init directory, which had two
 * defects that had nothing to do with shell: it ran ONLY when the data volume was first created — so it
 * could never repair an existing deployment — and it only ever ran for the bundled database service, so
 * a managed PostgreSQL got nothing at all.
 *
 * Run instead from the container entrypoint, before the application starts, it runs on every boot and
 * works against any reachable database. The entrypoint unsets the bootstrap URL before exec'ing the
 * app, so the privileged credential exists for the length of this command and is absent from the
 * long-lived process and from every plugin guest forked out of it.
 *
 * Doing nothing is a normal outcome: no bootstrap URL means the operator provisions roles themselves
 * (every managed database), and a driver with no login system reports that rather than failing.
 */
export class DatabaseRoleBootstrapService {
  /** The privileged connection used only to create logins. Never the connection the app serves on. */
  static readonly BOOTSTRAP_URL_ENV = 'DATABASE_BOOTSTRAP_URL';

  private static readonly logger = new Logger({ namespace: 'database-roles' });

  /**
   * Reads the plan out of the connection strings and applies it.
   *
   * The roles are not configured separately anywhere: `DATABASE_URL` and `DATABASE_MIGRATION_URL`
   * already name them and carry their passwords, and a second copy could only ever drift from the
   * connection actually used.
   */
  static plan(): DatabaseRolePlan | null {
    const runtime = DatabaseRole.fromConnectionUrl(DatabaseConnectionUrls.runtime());
    if (!runtime) return null;

    // Without a separate migration connection one role does both jobs — correct for a single-tenant
    // install, where there is no isolation to protect and nothing to split.
    const owner = DatabaseRole.fromConnectionUrl(DatabaseConnectionUrls.migration()) ?? runtime;

    const database = DatabaseRoleBootstrapService.databaseName(DatabaseConnectionUrls.runtime());
    if (!database) return null;

    return new DatabaseRolePlan(database, owner, runtime);
  }

  static async run(manager: { provisionRoles(plan: DatabaseRolePlan): Promise<DatabaseRoleOutcome> }): Promise<boolean> {
    const plan = DatabaseRoleBootstrapService.plan();
    if (!plan) {
      DatabaseRoleBootstrapService.logger.warn(
        'DATABASE_URL names no role or database, so there is nothing to provision.',
      );
      return false;
    }

    const outcome = await manager.provisionRoles(plan);
    if (!outcome.supported) {
      DatabaseRoleBootstrapService.logger.info(outcome.reason);
      return true;
    }

    DatabaseRoleBootstrapService.logger.info(
      `Provisioned ${outcome.roles.length} login(s): ${outcome.roles.join(', ')}`
      + (plan.isSingleRole ? ' — one role serves requests and runs migrations.' : ''),
    );
    return true;
  }

  /** The database a connection string points at — the path, minus its leading slash. */
  private static databaseName(url: string): string {
    try {
      return decodeURIComponent(new URL(String(url ?? '')).pathname.replace(/^\//, ''));
    } catch {
      return '';
    }
  }
}
