export interface IDatabaseBackupContext {
  readonly backupsPath: string;
  readonly timestamp: string;
  readonly projectRoot: string;
}
