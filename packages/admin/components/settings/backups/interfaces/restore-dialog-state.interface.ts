import type { RestoreTargetScope } from '@/components/settings/backups/enums/restore-target-scope.enum';
import type { IBackupCatalogItemView } from '@/components/settings/backups/interfaces/backup-catalog-item-view.interface';
import type { IRestorePreviewResponseView } from '@/components/settings/backups/interfaces/restore-preview-response-view.interface';

export interface IRestoreDialogState {
  backup: IBackupCatalogItemView | null;
  targetScope: RestoreTargetScope;
  targetSlug: string;
  preview: IRestorePreviewResponseView | null;
  confirmationText: string;
  formError: string;
}
