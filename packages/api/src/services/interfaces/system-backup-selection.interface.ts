import { BackupSectionKey } from '@fromcode119/core';

export interface ISystemBackupSelection {
  requestedSections: BackupSectionKey[];
  includedSections: BackupSectionKey[];
  warnings: string[];
}
