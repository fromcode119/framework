import type { BackupSectionKey } from './backup-service.types';

export interface CreateSystemBackupOptions {
  excludePaths?: string[];
  sections?: BackupSectionKey[];
}

export interface CreateSystemBackupResult {
  backupPath: string;
  requestedSections: BackupSectionKey[];
  includedSections: BackupSectionKey[];
  warnings: string[];
}