import { Enum } from '@fromcode119/reactor';

/** Supported backup archive file extensions. The `.value` is matched against real filenames. */
export class BackupArchiveExtension extends Enum {
  static readonly TAR_GZ = new BackupArchiveExtension('.tar.gz');
  static readonly SQL = new BackupArchiveExtension('.sql');
  static readonly DB = new BackupArchiveExtension('.db');

  private constructor(value: string) {
    super(value);
  }
}
