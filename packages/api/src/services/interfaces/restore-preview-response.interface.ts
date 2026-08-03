import { SnapshotType } from '@fromcode119/core';
import type { IBackupCatalogItem } from '@fromcode119/core';

export interface IRestorePreviewResponse {
  backup: IBackupCatalogItem;
  targetKind: string;
  targetLabel: string;
  warnings: string[];
  previewToken: string;
  previewExpiresAt: string;
  requiredConfirmationText: string;
  snapshotType: SnapshotType;
}
