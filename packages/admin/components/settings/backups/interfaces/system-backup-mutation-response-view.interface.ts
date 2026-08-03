import { BackupSectionKey } from '@fromcode119/core';
import type { IBackupCatalogItemView } from '@/components/settings/backups/interfaces/backup-catalog-item-view.interface';

export interface ISystemBackupMutationResponseView {
  success: true;
  backup: IBackupCatalogItemView;
  selection: {
    requestedSections: BackupSectionKey[];
    includedSections: BackupSectionKey[];
    warnings: string[];
  };
}
