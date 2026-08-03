import { SnapshotType } from '@fromcode119/core/client';
import type { IBackupCatalogItemView } from '@/components/settings/backups/interfaces/backup-catalog-item-view.interface';

export interface IRestorePreviewResponseView {
  backup: IBackupCatalogItemView;
  targetKind: string;
  targetLabel: string;
  warnings: string[];
  previewToken: string;
  previewExpiresAt: string;
  requiredConfirmationText: string;
  snapshotType: SnapshotType;
}
