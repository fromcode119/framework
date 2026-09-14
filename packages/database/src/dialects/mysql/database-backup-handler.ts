import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { IDatabaseBackupContext } from '@database/dialects/interfaces/database-backup-context.interface';
import type { IDatabaseBackupHandler } from '@database/dialects/interfaces/database-backup-handler.interface';

/**
 * A MySQL backup, which this driver had none of — the reason it could not be offered at install.
 *
 * `mysqldump` rather than anything clever, for the same reason the PostgreSQL handler shells out to
 * `pg_dump`: the server's own tool knows its own format, and a dump written by us would be one more
 * thing that can be subtly wrong exactly when someone needs it most.
 *
 * TWO DIFFERENCES FROM THE POSTGRES HANDLER, both deliberate:
 *
 *  - **`execFile`, not `exec`.** `pg_dump` takes the whole connection as one URL; `mysqldump` takes
 *    separate flags, and a password is one of them. Through a shell those arguments would be parsed
 *    by the shell first, so a password containing a quote or a `$` would break the command or run
 *    part of itself. `execFile` passes the argument vector straight to the process.
 *  - **The password goes through the ENVIRONMENT.** `--password=` on the command line is visible in
 *    `ps` to every user on the host for as long as the dump runs, which on a large database is
 *    minutes. `MYSQL_PWD` is read by the client and is not in the process title.
 *
 * `--single-transaction` so the dump is consistent without locking the tables an application is
 * still serving from, and `--routines --triggers --events` because a restore that silently omits
 * them looks complete and is not.
 */
export class MysqlDatabaseBackupHandler implements IDatabaseBackupHandler {
  private static readonly execFileAsync = promisify(execFile);

  readonly dialect = 'mysql';

  async createBackup(dbUrl: string, context: IDatabaseBackupContext): Promise<string | null> {
    const target = MysqlDatabaseBackupHandler.parse(dbUrl);
    if (!target) {
      console.error('[BackupService] MySQL dump skipped: the connection string names no database.');
      return null;
    }

    const dumpPath = path.join(context.backupsPath, `db-dump-${context.timestamp}.sql`);

    try {
      await MysqlDatabaseBackupHandler.execFileAsync('mysqldump', [
        `--host=${target.host}`,
        `--port=${target.port}`,
        `--user=${target.user}`,
        '--single-transaction',
        '--routines',
        '--triggers',
        '--events',
        `--result-file=${dumpPath}`,
        target.database,
      ], {
        // Not `--password=` on the argv: that is readable in `ps` by every user on the host for the
        // whole length of the dump.
        env: { ...process.env, MYSQL_PWD: target.password },
        maxBuffer: 1024 * 1024 * 64,
      });
      return dumpPath;
    } catch (error: any) {
      console.error(`[BackupService] MySQL dump failed: ${error?.message ?? error}`);
      return null;
    }
  }

  /** The parts `mysqldump` needs, or null when the URL names no database to dump. */
  private static parse(dbUrl: string): IMysqlBackupTarget | null {
    try {
      const url = new URL(String(dbUrl || '').trim());
      const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
      if (!database) return null;

      return {
        host: url.hostname || '127.0.0.1',
        port: url.port || '3306',
        user: decodeURIComponent(url.username || 'root'),
        password: decodeURIComponent(url.password || ''),
        database,
      };
    } catch {
      return null;
    }
  }
}

interface IMysqlBackupTarget {
  readonly host: string;
  readonly port: string;
  readonly user: string;
  readonly password: string;
  readonly database: string;
}
