import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { IDatabaseBackupContext } from '@database/dialects/interfaces/database-backup-context.interface';
import type { IDatabaseBackupHandler } from '@database/dialects/interfaces/database-backup-handler.interface';

export class PostgresDatabaseBackupHandler implements IDatabaseBackupHandler {
  private static readonly execAsync = promisify(exec);

  readonly dialect = 'postgres';

  async createBackup(dbUrl: string, context: IDatabaseBackupContext): Promise<string | null> {
    const dumpPath = path.join(context.backupsPath, `db-dump-${context.timestamp}.sql`);

    try {
      await PostgresDatabaseBackupHandler.execAsync(`pg_dump "${dbUrl}" > "${dumpPath}"`);
      return dumpPath;
    } catch (error: any) {
      console.error(`[BackupService] PostgreSQL dump failed: ${error.message}`);
      return null;
    }
  }
}