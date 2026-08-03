import type { IBackupCatalogItemView } from '@/components/settings/backups/interfaces/backup-catalog-item-view.interface';

export interface IRestoreExecuteResponseView {
  success: true;
  backup: IBackupCatalogItemView;
  targetKind: string;
  rollbackSnapshotPath: string;
}
