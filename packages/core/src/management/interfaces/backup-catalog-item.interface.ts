import type { BackupCatalogGroupKey } from '@core/management/enums/backup-catalog-group-key.enum';
import type { BackupCatalogRootKind } from '@core/management/enums/backup-catalog-root-kind.enum';

/** One archive in the backup catalog. */
export interface IBackupCatalogItem {
  id: string;
  filename: string;
  displayName: string;
  group: BackupCatalogGroupKey;
  rootKind: BackupCatalogRootKind;
  scopeSlug: string | null;
  sizeBytes: number;
  modifiedAt: string;
}
