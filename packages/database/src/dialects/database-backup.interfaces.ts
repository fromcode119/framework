export interface DatabaseBackupContext {
  readonly backupsPath: string;
  readonly timestamp: string;
  readonly projectRoot: string;
}

export interface DatabaseBackupHandler {
  readonly dialect: string;

  createBackup(dbUrl: string, context: DatabaseBackupContext): Promise<string | null>;
}