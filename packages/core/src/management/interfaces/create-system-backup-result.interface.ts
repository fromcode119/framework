import { BackupSectionKey } from '@core/management/enums/backup-section-key.enum';

export interface ICreateSystemBackupResult {
  backupPath: string;
  requestedSections: BackupSectionKey[];
  includedSections: BackupSectionKey[];
  warnings: string[];
}
