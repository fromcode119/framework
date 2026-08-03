import { BackupCatalogGroupKey } from '@fromcode119/core';
import type { IBackupCatalogItemView } from '@/components/settings/backups/interfaces/backup-catalog-item-view.interface';

export interface IBackupCatalogGroupView {
  key: BackupCatalogGroupKey;
  label: string;
  items: IBackupCatalogItemView[];
}
