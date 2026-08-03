import type { IBackupCatalogResolvedItem } from '@core/management/interfaces/backup-catalog-resolved-item.interface';
import type { RestoreTarget } from '@core/management/restore-target';

export interface IRestoreExecutionResult {
  backup: IBackupCatalogResolvedItem;
  targetKind: RestoreTarget;
  targetPath: string;
  rollbackSnapshotPath: string;
}
