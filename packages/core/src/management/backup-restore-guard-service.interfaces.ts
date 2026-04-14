import type { BackupCatalogResolvedItem } from './backup-catalog-service.types';
import type { RestoreTargetKind } from './backup-restore-guard-service.types';

export interface RestorePreviewInput {
  backupId: string;
  targetKind: RestoreTargetKind;
}

export interface RestoreExecutionInput extends RestorePreviewInput {
  previewToken: string;
  confirmationText: string;
}

export interface RestorePreviewSession {
  token: string;
  backupId: string;
  targetKind: RestoreTargetKind;
  requiredConfirmationText: string;
  expiresAt: string;
}

export interface RestoreTargetResolution {
  backup: BackupCatalogResolvedItem;
  targetKind: RestoreTargetKind;
  targetLabel: string;
  targetPath: string;
  warnings: string[];
  previewToken: string;
  previewExpiresAt: string;
  requiredConfirmationText: string;
  snapshotType: 'system' | 'plugins' | 'themes';
}

export interface RestoreExecutionResult {
  backup: BackupCatalogResolvedItem;
  targetKind: RestoreTargetKind;
  targetPath: string;
  rollbackSnapshotPath: string;
}