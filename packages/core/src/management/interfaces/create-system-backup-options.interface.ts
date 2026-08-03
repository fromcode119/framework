import { BackupSectionKey } from '@core/management/enums/backup-section-key.enum';

export interface ICreateSystemBackupOptions {
  excludePaths?: string[];
  sections?: BackupSectionKey[];
}
