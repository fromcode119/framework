import type { IDatabaseBackupContext } from '@database/dialects/interfaces/database-backup-context.interface';

export interface IDatabaseBackupHandler {
  readonly dialect: string;

  createBackup(dbUrl: string, context: IDatabaseBackupContext): Promise<string | null>;
}
