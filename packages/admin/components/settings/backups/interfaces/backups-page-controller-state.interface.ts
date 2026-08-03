import type { RestoreTargetScope } from '@/components/settings/backups/enums/restore-target-scope.enum';
import { BackupPreset } from '@/components/settings/backups/enums/backup-preset.enum';
import { BackupSectionKey } from '@fromcode119/core';
import type { IBackupCatalogItemView } from '@/components/settings/backups/interfaces/backup-catalog-item-view.interface';
import type { ISystemBackupHookState } from '@/components/settings/backups/interfaces/system-backup-hook-state.interface';
import type { IRestoreDialogState } from '@/components/settings/backups/interfaces/restore-dialog-state.interface';

export interface IBackupsPageControllerState {
  backupState: ISystemBackupHookState;
  createSections: BackupSectionKey[];
  deleteCandidate: IBackupCatalogItemView | null;
  restoreState: IRestoreDialogState;
  handleRefresh: () => Promise<void>;
  handleCreate: () => Promise<void>;
  handleImport: (file: File) => Promise<void>;
  handleDelete: () => Promise<void>;
  handleDownload: (id: string) => Promise<void>;
  toggleCreateSection: (value: BackupSectionKey) => void;
  applyCreatePreset: (value: BackupPreset) => void;
  handleRequestDelete: (item: IBackupCatalogItemView) => void;
  handleRequestRestore: (item: IBackupCatalogItemView) => void;
  closeDeleteDialog: () => void;
  closeRestoreDialog: () => void;
  updateRestoreTargetScope: (value: RestoreTargetScope) => void;
  updateRestoreTargetSlug: (value: string) => void;
  updateRestoreConfirmationText: (value: string) => void;
  handlePreviewRestore: () => Promise<void>;
  handleExecuteRestore: () => Promise<void>;
}
