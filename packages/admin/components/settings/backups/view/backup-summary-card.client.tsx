import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import type { ReactNode } from 'react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Badge } from '@/components/ui/view/badge.client';
import { StatCard } from '@/components/ui/view/stat-card.client';
import { Columns } from '@/components/ui/view/columns.client';
import { FrameworkIcons } from '@fromcode119/react';
import { prop } from '@fromcode119/react-class-components';
import type { IBackupCatalogGroupView } from '@/components/settings/backups/interfaces/backup-catalog-group-view.interface';
import type { ISystemBackupCapabilities } from '@/components/settings/backups/interfaces/system-backup-capabilities.interface';
import { SystemBackupPageUtils } from '@/components/settings/backups/system-backup-page-utils';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class BackupSummaryCard extends AdminComponent {
  @prop declare groups: IBackupCatalogGroupView[];
  @prop declare capabilities: ISystemBackupCapabilities;

  render(): ReactNode {
    const { groups, capabilities } = this;
    const totalBackups = SystemBackupPageUtils.totalBackups(groups);
    const latestBackup = SystemBackupPageUtils.getLatestBackup(groups);
    // What this account may do with the archives, then the three figures of the inventory.
    return (
      <>
        <div className="fc-chip-row fc-chip-row--cell">
          <Badge variant={capabilities.canManage ? BadgeVariant.SUCCESS : BadgeVariant.GRAY}>
            {capabilities.canManage ? AdminI18n.t('settings.components.createDeleteEnabled') : AdminI18n.t('settings.components.readOnly')}
          </Badge>
          <Badge variant={capabilities.canRestore ? BadgeVariant.WARNING : BadgeVariant.GRAY}>
            {capabilities.canRestore ? AdminI18n.t('settings.components.restoreAuthorized') : AdminI18n.t('settings.components.restoreRestricted')}
          </Badge>
        </div>
        <Columns count={3}>
          <StatCard title={AdminI18n.t('settings.components.totalBackups')} value={String(totalBackups)} icon={<FrameworkIcons.Database size={15} />}
            note={AdminI18n.t('settings.components.groupedInventoryAcrossManagedBackup')} />
          <StatCard title={AdminI18n.t('settings.components.indexedSize')} value={SystemBackupPageUtils.formatBytes(SystemBackupPageUtils.totalBytes(groups))} icon={<FrameworkIcons.Layers size={15} />}
            note={AdminI18n.t('settings.components.visibleArchiveSizeAcrossCurrent')} />
          <StatCard title={AdminI18n.t('settings.components.latestSnapshot')} value={latestBackup ? latestBackup.displayName : AdminI18n.t('settings.components.noSnapshotsYet')} icon={<FrameworkIcons.Clock size={15} />}
            note={latestBackup ? SystemBackupPageUtils.formatTimestamp(latestBackup.modifiedAt) : AdminI18n.t('settings.components.createASystemBackupTo')} />
        </Columns>
      </>
    );
  }
}
