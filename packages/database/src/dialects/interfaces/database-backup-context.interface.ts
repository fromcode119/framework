export interface IDatabaseBackupContext {
  readonly backupsPath: string;
  readonly timestamp: string;
  readonly projectRoot: string;
  /**
   * Where a handler says what the operator has to know about this dump: a table it had to leave out,
   * or why no dump was written. The caller shows these beside the finished backup.
   */
  readonly warnings?: string[];
}
