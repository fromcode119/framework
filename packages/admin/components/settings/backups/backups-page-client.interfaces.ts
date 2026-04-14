export interface BackupCatalogItemView {
  id: string;
  filename: string;
  displayName: string;
  group: 'system' | 'plugins' | 'themes' | 'database' | 'transfer';
  rootKind: 'backups' | 'site-transfer';
  scopeSlug: string | null;
  sizeBytes: number;
  modifiedAt: string;
}

export interface BackupCatalogGroupView {
  key: 'system' | 'plugins' | 'themes' | 'database' | 'transfer';
  label: string;
  items: BackupCatalogItemView[];
}

export interface SystemBackupCapabilities {
  canManage: boolean;
  canRestore: boolean;
}

export interface SystemBackupListResponseView {
  groups: BackupCatalogGroupView[];
  capabilities: SystemBackupCapabilities;
}

export interface SystemBackupMutationResponseView {
  success: true;
  backup: BackupCatalogItemView;
  selection: {
    requestedSections: ('core' | 'database' | 'plugins' | 'themes')[];
    includedSections: ('core' | 'database' | 'plugins' | 'themes')[];
    warnings: string[];
  };
}

export interface BackupProgressView {
  percent: number;
  label: string;
}

export interface BackupDownloadProgressView {
  activeId: string;
  percent: number | null;
  label: string;
  loadedBytes: number;
  totalBytes: number | null;
}

export interface RestorePreviewResponseView {
  backup: BackupCatalogItemView;
  targetKind: string;
  targetLabel: string;
  warnings: string[];
  previewToken: string;
  previewExpiresAt: string;
  requiredConfirmationText: string;
  snapshotType: 'system' | 'plugins' | 'themes';
}

export interface RestoreExecuteResponseView {
  success: true;
  backup: BackupCatalogItemView;
  targetKind: string;
  rollbackSnapshotPath: string;
}

export interface SystemBackupHookState {
  groups: BackupCatalogGroupView[];
  capabilities: SystemBackupCapabilities;
  errorMessage: string;
  isLoading: boolean;
  isRefreshing: boolean;
  isCreating: boolean;
  createProgress: BackupProgressView | null;
  downloadProgress: BackupDownloadProgressView | null;
  activeDeleteId: string;
  activePreviewId: string;
  activeRestoreId: string;
  refreshBackups(options?: { initial?: boolean }): Promise<SystemBackupListResponseView>;
  createSystemBackup(request: { sections: ('core' | 'database' | 'plugins' | 'themes')[] }): Promise<SystemBackupMutationResponseView>;
  deleteBackup(id: string): Promise<SystemBackupMutationResponseView>;
  downloadBackup(id: string): Promise<string>;
  previewRestore(id: string, targetKind: string): Promise<RestorePreviewResponseView>;
  executeRestore(id: string, targetKind: string, previewToken: string, confirmationText: string): Promise<RestoreExecuteResponseView>;
}

export interface BackupsPageClientProps {}

export interface BackupsPageControllerState {
  backupState: SystemBackupHookState;
  createSections: ('core' | 'database' | 'plugins' | 'themes')[];
  deleteCandidate: BackupCatalogItemView | null;
  restoreState: RestoreDialogState;
  handleRefresh(): Promise<void>;
  handleCreate(): Promise<void>;
  handleDelete(): Promise<void>;
  handleDownload(id: string): Promise<void>;
  toggleCreateSection(value: 'core' | 'database' | 'plugins' | 'themes'): void;
  applyCreatePreset(value: 'full' | 'core-db' | 'plugins-only' | 'themes-only'): void;
  handleRequestDelete(item: BackupCatalogItemView): void;
  handleRequestRestore(item: BackupCatalogItemView): void;
  closeDeleteDialog(): void;
  closeRestoreDialog(): void;
  updateRestoreTargetScope(value: 'system' | 'plugin' | 'theme'): void;
  updateRestoreTargetSlug(value: string): void;
  updateRestoreConfirmationText(value: string): void;
  handlePreviewRestore(): Promise<void>;
  handleExecuteRestore(): Promise<void>;
}

export interface BackupSummaryCardProps {
  groups: BackupCatalogGroupView[];
  capabilities: SystemBackupCapabilities;
}

export interface BackupListCardProps {
  groups: BackupCatalogGroupView[];
  capabilities: SystemBackupCapabilities;
  isRefreshing: boolean;
  downloadProgress: BackupDownloadProgressView | null;
  activeDeleteId: string;
  activePreviewId: string;
  onRefresh(): Promise<void>;
  onDownload(id: string): Promise<void>;
  onRequestDelete(item: BackupCatalogItemView): void;
  onRequestRestore(item: BackupCatalogItemView): void;
}

export interface BackupCreateCardProps {
  capabilities: SystemBackupCapabilities;
  createSections: ('core' | 'database' | 'plugins' | 'themes')[];
  isCreating: boolean;
  createProgress: BackupProgressView | null;
  onToggleSection(value: 'core' | 'database' | 'plugins' | 'themes'): void;
  onApplyPreset(value: 'full' | 'core-db' | 'plugins-only' | 'themes-only'): void;
  onCreate(): Promise<void>;
}

export interface RestoreDialogState {
  backup: BackupCatalogItemView | null;
  targetScope: 'system' | 'plugin' | 'theme';
  targetSlug: string;
  preview: RestorePreviewResponseView | null;
  confirmationText: string;
  formError: string;
}

export interface BackupRestoreDialogProps {
  isOpen: boolean;
  state: RestoreDialogState;
  isPreviewing: boolean;
  isRestoring: boolean;
  onClose(): void;
  onTargetScopeChange(value: 'system' | 'plugin' | 'theme'): void;
  onTargetSlugChange(value: string): void;
  onConfirmationTextChange(value: string): void;
  onPreview(): Promise<void>;
  onExecute(): Promise<void>;
}