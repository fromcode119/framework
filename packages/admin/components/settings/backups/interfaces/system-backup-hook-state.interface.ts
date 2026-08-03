import { BackupSectionKey } from '@fromcode119/core';
import type { IBackupCatalogGroupView } from '@/components/settings/backups/interfaces/backup-catalog-group-view.interface';
import type { ISystemBackupCapabilities } from '@/components/settings/backups/interfaces/system-backup-capabilities.interface';
import type { ISystemBackupListResponseView } from '@/components/settings/backups/interfaces/system-backup-list-response-view.interface';
import type { ISystemBackupMutationResponseView } from '@/components/settings/backups/interfaces/system-backup-mutation-response-view.interface';
import type { IBackupProgressView } from '@/components/settings/backups/interfaces/backup-progress-view.interface';
import type { IBackupDownloadProgressView } from '@/components/settings/backups/interfaces/backup-download-progress-view.interface';
import type { IRestorePreviewResponseView } from '@/components/settings/backups/interfaces/restore-preview-response-view.interface';
import type { IRestoreExecuteResponseView } from '@/components/settings/backups/interfaces/restore-execute-response-view.interface';

export interface ISystemBackupHookState {
  groups: IBackupCatalogGroupView[];
  capabilities: ISystemBackupCapabilities;
  errorMessage: string;
  isLoading: boolean;
  isRefreshing: boolean;
  isCreating: boolean;
  isImporting: boolean;
  createProgress: IBackupProgressView | null;
  importProgress: IBackupProgressView | null;
  downloadProgress: IBackupDownloadProgressView | null;
  activeDeleteId: string;
  activePreviewId: string;
  activeRestoreId: string;
  refreshBackups: (options?: { initial?: boolean }) => Promise<ISystemBackupListResponseView>;
  createSystemBackup: (request: { sections: BackupSectionKey[] }) => Promise<ISystemBackupMutationResponseView>;
  importBackup: (file: File) => Promise<ISystemBackupMutationResponseView>;
  deleteBackup: (id: string) => Promise<ISystemBackupMutationResponseView>;
  downloadBackup: (id: string) => Promise<string>;
  previewRestore: (id: string, targetKind: string) => Promise<IRestorePreviewResponseView>;
  executeRestore: (id: string, targetKind: string, previewToken: string, confirmationText: string) => Promise<IRestoreExecuteResponseView>;
}
