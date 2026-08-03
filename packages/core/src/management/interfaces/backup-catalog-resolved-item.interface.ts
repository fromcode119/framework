import { IBackupCatalogItem } from '@core/management/interfaces/backup-catalog-item.interface';

/** A catalog item with its resolved on-disk location. */
export interface IBackupCatalogResolvedItem extends IBackupCatalogItem {
  absolutePath: string;
  relativePath: string;
}
