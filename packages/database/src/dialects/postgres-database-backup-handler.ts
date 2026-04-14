import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { DatabaseBackupContext, DatabaseBackupHandler } from './database-backup.interfaces';

const execAsync = promisify(exec);

export class PostgresDatabaseBackupHandler implements DatabaseBackupHandler {
  readonly dialect = 'postgres';

  async createBackup(dbUrl: string, context: DatabaseBackupContext): Promise<string | null> {
    const dumpPath = path.join(context.backupsPath, `db-dump-${context.timestamp}.sql`);

    try {
      await execAsync(`pg_dump "${dbUrl}" > "${dumpPath}"`);
      return dumpPath;
    } catch (error: any) {
      console.error(`[BackupService] PostgreSQL dump failed: ${error.message}`);
      return null;
    }
  }
}