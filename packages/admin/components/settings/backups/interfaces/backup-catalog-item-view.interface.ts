import { BackupCatalogGroupKey, BackupCatalogRootKind } from '@fromcode119/core';
export interface IBackupCatalogItemView {
  id: string;
  filename: string;
  displayName: string;
  group: BackupCatalogGroupKey;
  rootKind: BackupCatalogRootKind;
  scopeSlug: string | null;
  sizeBytes: number;
  modifiedAt: string;
}
