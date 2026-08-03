import type { IBackupCatalogGroupView } from '@/components/settings/backups/interfaces/backup-catalog-group-view.interface';
import type { ISystemBackupCapabilities } from '@/components/settings/backups/interfaces/system-backup-capabilities.interface';

export interface ISystemBackupListResponseView {
  groups: IBackupCatalogGroupView[];
  capabilities: ISystemBackupCapabilities;
}
