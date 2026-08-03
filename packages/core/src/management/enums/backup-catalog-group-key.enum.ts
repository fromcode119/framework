import { Enum } from '@fromcode119/reactor';

/** Which group a backup catalog entry is displayed under. */
export class BackupCatalogGroupKey extends Enum {
  static readonly SYSTEM = new BackupCatalogGroupKey('system');
  static readonly PLUGINS = new BackupCatalogGroupKey('plugins');
  static readonly THEMES = new BackupCatalogGroupKey('themes');
  static readonly DATABASE = new BackupCatalogGroupKey('database');
  static readonly TRANSFER = new BackupCatalogGroupKey('transfer');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; defaults to SYSTEM. */
  static resolve(value: unknown): BackupCatalogGroupKey {
    if (value instanceof BackupCatalogGroupKey) return value;
    const found = BackupCatalogGroupKey.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as BackupCatalogGroupKey | undefined) ?? BackupCatalogGroupKey.SYSTEM;
  }
}
