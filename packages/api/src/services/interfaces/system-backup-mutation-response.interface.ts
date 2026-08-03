import type { IBackupCatalogItem } from '@fromcode119/core';
import type { ISystemBackupSelection } from '@api/services/interfaces/system-backup-selection.interface';

export interface ISystemBackupMutationResponse {
  success: true;
  backup: IBackupCatalogItem;
  selection: ISystemBackupSelection;
}
