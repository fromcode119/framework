import { Enum } from '@fromcode119/reactor';

/** Which root directory a catalog entry lives under. The `.value` is the directory name. */
export class BackupCatalogRootKind extends Enum {
  static readonly BACKUPS = new BackupCatalogRootKind('backups');
  static readonly SITE_TRANSFER = new BackupCatalogRootKind('site-transfer');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; defaults to BACKUPS. */
  static resolve(value: unknown): BackupCatalogRootKind {
    if (value instanceof BackupCatalogRootKind) return value;
    const found = BackupCatalogRootKind.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as BackupCatalogRootKind | undefined) ?? BackupCatalogRootKind.BACKUPS;
  }
}
