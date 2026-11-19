import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { IDatabaseBackupContext } from '@database/dialects/interfaces/database-backup-context.interface';
import type { IDatabaseBackupHandler } from '@database/dialects/interfaces/database-backup-handler.interface';

/**
 * A PostgreSQL backup through the server's own `pg_dump`.
 *
 * - **The password never reaches the command line or a log.** It used to be part of one shell string
 *   (`pg_dump "<url>" > file`): readable in `ps` for the length of the dump, parsed by the shell first,
 *   and printed whole in the error message whenever the dump failed. It now travels in `PGPASSWORD`,
 *   the connection string is passed without it, and `execFile` hands the arguments to the process
 *   untouched.
 * - **One table the connecting role cannot read does not cost the whole dump.** `pg_dump` locks every
 *   table before it writes anything, so a single table made by hand under another role refused the
 *   lot. Such relations are left out and each one is named in a warning.
 * - **A dump that still fails says why.** The first line `pg_dump` wrote is reported, so the backup
 *   screen shows the cause instead of "no snapshot available".
 */
export class PostgresDatabaseBackupHandler implements IDatabaseBackupHandler {
  private static readonly execFileAsync = promisify(execFile);

  /** Tables, partitioned tables, sequences and materialised views the connecting role may not read. */
  private static readonly UNREADABLE_SQL = `
    SELECT format('%I.%I', n.nspname, c.relname)
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r', 'p', 'S', 'm')
      AND n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg\\_%'
      AND NOT has_table_privilege(c.oid, 'SELECT')
    ORDER BY 1`;

  readonly dialect = 'postgres';

  async createBackup(dbUrl: string, context: IDatabaseBackupContext): Promise<string | null> {
    const target = PostgresDatabaseBackupHandler.parse(dbUrl);
    if (!target) {
      console.error('[BackupService] PostgreSQL dump skipped: the connection string could not be read.');
      context.warnings?.push('The database was not backed up: its connection string could not be read.');
      return null;
    }

    const dumpPath = path.join(context.backupsPath, `db-dump-${context.timestamp}.sql`);
    const options = { env: { ...process.env, PGPASSWORD: target.password }, maxBuffer: 1024 * 1024 * 64 };
    const unreadable = await PostgresDatabaseBackupHandler.unreadableRelations(target.connection, options);

    try {
      await PostgresDatabaseBackupHandler.execFileAsync('pg_dump', [
        `--dbname=${target.connection}`,
        `--file=${dumpPath}`,
        ...unreadable.map((relation) => `--exclude-table=${relation}`),
      ], options);
    } catch (error: any) {
      // What pg_dump wrote before it stopped is not a backup, and must not be kept as one.
      fs.rmSync(dumpPath, { force: true });
      const reason = PostgresDatabaseBackupHandler.reason(error, target.password);
      console.error(`[BackupService] PostgreSQL dump failed: ${reason}`);
      context.warnings?.push(`The database was not backed up: ${reason}`);
      return null;
    }

    if (unreadable.length) {
      const message = `The database backup leaves out ${unreadable.length === 1 ? 'a table' : 'tables'} the application's database role cannot read: ${unreadable.join(', ')}.`;
      console.warn(`[BackupService] ${message}`);
      context.warnings?.push(message);
    }
    return dumpPath;
  }

  /** Asked of the server before the dump. If it cannot be asked, the dump runs with nothing left out. */
  private static async unreadableRelations(connection: string, options: Record<string, unknown>): Promise<string[]> {
    try {
      const { stdout } = await PostgresDatabaseBackupHandler.execFileAsync('psql', [
        `--dbname=${connection}`, '--no-psqlrc', '--tuples-only', '--no-align', '--set=ON_ERROR_STOP=1',
        `--command=${PostgresDatabaseBackupHandler.UNREADABLE_SQL}`,
      ], options);
      return String(stdout || '').split('\n').map((line) => line.trim()).filter(Boolean);
    } catch {
      return [];
    }
  }

  /** The connection string without its password, and the password on its own. */
  private static parse(dbUrl: string): { connection: string; password: string } | null {
    try {
      const url = new URL(String(dbUrl || '').trim());
      const password = decodeURIComponent(url.password || '');
      url.password = '';
      return { connection: url.toString(), password };
    } catch {
      return null;
    }
  }

  /** What `pg_dump` itself said, first line only, with the password taken out wherever it appears. */
  private static reason(error: any, password: string): string {
    const said = String(error?.stderr || error?.message || error).split('\n').map((line) => line.trim()).find(Boolean) || 'pg_dump failed';
    const secrets = [password, encodeURIComponent(password)].filter(Boolean);
    return secrets.reduce((text, secret) => text.split(secret).join('***'), said);
  }
}
