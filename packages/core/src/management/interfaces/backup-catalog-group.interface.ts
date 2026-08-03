import type { BackupCatalogGroupKey } from '@core/management/enums/backup-catalog-group-key.enum';
import type { IBackupCatalogItem } from '@core/management/interfaces/backup-catalog-item.interface';

/** A display group of catalog items. */
export interface IBackupCatalogGroup {
  key: BackupCatalogGroupKey;
  label: string;
  items: IBackupCatalogItem[];
}
