import type { IBackupCatalogGroup } from '@fromcode119/core';
import type { ISystemBackupCapabilities } from '@api/services/interfaces/system-backup-capabilities.interface';

export interface ISystemBackupListResponse {
  groups: IBackupCatalogGroup[];
  capabilities: ISystemBackupCapabilities;
}
