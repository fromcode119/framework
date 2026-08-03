import type { IBackupCatalogItem } from '@fromcode119/core';

export interface IRestoreExecuteResponse {
  success: true;
  backup: IBackupCatalogItem;
  targetKind: string;
  rollbackSnapshotPath: string;
}
