import { SnapshotType } from '@core/management/enums/snapshot-type.enum';
import type { IBackupCatalogResolvedItem } from '@core/management/interfaces/backup-catalog-resolved-item.interface';
import type { RestoreTarget } from '@core/management/restore-target';

export interface IRestoreTargetResolution {
  backup: IBackupCatalogResolvedItem;
  targetKind: RestoreTarget;
  targetLabel: string;
  targetPath: string;
  warnings: string[];
  previewToken: string;
  previewExpiresAt: string;
  requiredConfirmationText: string;
  snapshotType: SnapshotType;
}
