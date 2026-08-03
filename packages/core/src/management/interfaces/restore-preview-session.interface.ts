import type { RestoreTarget } from '@core/management/restore-target';

export interface IRestorePreviewSession {
  token: string;
  backupId: string;
  targetKind: RestoreTarget;
  requiredConfirmationText: string;
  expiresAt: string;
}
