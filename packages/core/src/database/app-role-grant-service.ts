import { DatabaseConnectionUrls } from '@fromcode119/database';
import { Logger } from '@core/logging';

/**
 * Keeps the runtime role able to read and write the tables the OWNER creates.
 *
 * Postgres default privileges are attached to the role that creates an object, so a grant made for one
 * role says nothing about tables another role creates. The deployment's init script set them for the
 * superuser that owns the database, while migrations actually run as a separate schema-owner role — so
 * every table a migration created was invisible to the runtime role, and the api answered
 * "permission denied" on essentially every query.
 *
 * This runs on the OWNER connection, after migrations, on every boot. That matters more than getting it
 * right once: an init script only ever runs when the data volume is first created, so an existing
 * deployment could never be repaired by it, and a table added later was never covered. Grants are
 * idempotent, so repeating them costs nothing.
 *
 * No new configuration: the role to grant to is the one `DATABASE_URL` already names, and the role to
 * attach default privileges to is whoever this connection is — `CURRENT_USER` — because that is by
 * definition the role creating the tables.
 */
export class AppRoleGrantService {
  private static readonly logger = new Logger({ namespace: 'app-role-grants' });
  private static readonly POSTGRES = 'postgres';

  static async apply(db: {
    dialect?: string;
    grantRuntimePrivileges(role: string): Promise<{ supported: boolean; reason: string }>;
  }): Promise<void> {
    if (String(db?.dialect || '').toLowerCase() !== AppRoleGrantService.POSTGRES) return;
    // One role doing both jobs has nothing to grant to itself.
    if (!DatabaseConnectionUrls.hasSeparateMigrationConnection()) return;

    const role = DatabaseConnectionUrls.runtimeRole();
    if (!role) {
      AppRoleGrantService.logger.warn(
        'DATABASE_URL names no role, so table privileges for the runtime role cannot be granted.',
      );
      return;
    }

    try {
      const outcome = await db.grantRuntimePrivileges(role);
      if (!outcome.supported) {
        AppRoleGrantService.logger.info(outcome.reason);
        return;
      }
      AppRoleGrantService.logger.info(`Runtime role "${role}" granted table and sequence privileges.`);
    } catch (error: any) {
      // Not fatal on its own: a deployment whose grants were made by hand is already correct, and
      // failing the boot here would take down a working install over a no-op.
      AppRoleGrantService.logger.error(
        `Could not grant privileges to the runtime role "${role}": ${error?.message || error}. `
        + 'If the api reports "permission denied" on ordinary queries, this is why.',
      );
    }
  }
}
