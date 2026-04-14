export type BackupCatalogRootKind = 'backups' | 'site-transfer';

export type BackupCatalogGroupKey = 'system' | 'plugins' | 'themes' | 'database' | 'transfer';

export type BackupCatalogItem = {
  id: string;
  filename: string;
  displayName: string;
  group: BackupCatalogGroupKey;
  rootKind: BackupCatalogRootKind;
  scopeSlug: string | null;
  sizeBytes: number;
  modifiedAt: string;
};

export type BackupCatalogResolvedItem = BackupCatalogItem & {
  absolutePath: string;
  relativePath: string;
};

export type BackupCatalogGroup = {
  key: BackupCatalogGroupKey;
  label: string;
  items: BackupCatalogItem[];
};