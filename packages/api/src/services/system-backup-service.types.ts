import type { BackupCatalogGroup, BackupCatalogItem, BackupSectionKey, RestoreTargetKind } from '@fromcode119/core';

export type CreateSystemBackupRequest = {
  sections?: BackupSectionKey[];
};

export type SystemBackupSelection = {
  requestedSections: BackupSectionKey[];
  includedSections: BackupSectionKey[];
  warnings: string[];
};

export type SystemBackupCapabilities = {
  canManage: boolean;
  canRestore: boolean;
};

export type SystemBackupListResponse = {
  groups: BackupCatalogGroup[];
  capabilities: SystemBackupCapabilities;
};

export type SystemBackupMutationResponse = {
  success: true;
  backup: BackupCatalogItem;
  selection: SystemBackupSelection;
};

export type RestorePreviewResponse = {
  backup: BackupCatalogItem;
  targetKind: RestoreTargetKind;
  targetLabel: string;
  warnings: string[];
  previewToken: string;
  previewExpiresAt: string;
  requiredConfirmationText: string;
  snapshotType: 'system' | 'plugins' | 'themes';
};

export type RestoreExecuteResponse = {
  success: true;
  backup: BackupCatalogItem;
  targetKind: RestoreTargetKind;
  rollbackSnapshotPath: string;
};