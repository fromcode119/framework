import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Badge } from '@/components/ui/view/badge.client';
import { Card } from '@/components/ui/view/card.client';
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
    const groups = this.groups;
    const capabilities = this.capabilities;
    const theme = this.theme;
    const totalBackups = SystemBackupPageUtils.totalBackups(groups);
    const totalBytes = SystemBackupPageUtils.totalBytes(groups);
    const latestBackup = SystemBackupPageUtils.getLatestBackup(groups);

    return (
    <Card>
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${theme === ThemeMode.DARK ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
              <FrameworkIcons.Database size={24} />
            </div>
            <div>
              <h2 className={`text-lg font-bold tracking-tight ${theme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>
                {AdminI18n.t('settings.components.backupInventory')}
              </h2>
              <p className="text-sm text-slate-500">
                {AdminI18n.t('settings.components.reviewSystemSnapshotsPluginArchives')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant={capabilities.canManage ? 'success' : 'gray'}>
              {capabilities.canManage ? AdminI18n.t('settings.components.createDeleteEnabled') : AdminI18n.t('settings.components.readOnly')}
            </Badge>
            <Badge variant={capabilities.canRestore ? 'warning' : 'gray'}>
              {capabilities.canRestore ? AdminI18n.t('settings.components.restoreAuthorized') : AdminI18n.t('settings.components.restoreRestricted')}
            </Badge>
            <Badge variant={BadgeVariant.BLUE}>{AdminI18n.t('settings.components.itemsIndexed', { count: totalBackups })}</Badge>
          </div>
        </div>

        <div className="grid w-full gap-4 sm:grid-cols-3 lg:max-w-2xl">
          <div className={`rounded-lg border p-5 ${theme === ThemeMode.DARK ? 'border-white/5 bg-slate-900/60' : 'border-slate-100 bg-slate-50/80'}`}>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{AdminI18n.t('settings.components.totalBackups')}</div>
            <div className={`mt-3 text-3xl font-bold tracking-tight ${theme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>{totalBackups}</div>
            <p className="mt-2 text-xs text-slate-500">{AdminI18n.t('settings.components.groupedInventoryAcrossManagedBackup')}</p>
          </div>

          <div className={`rounded-lg border p-5 ${theme === ThemeMode.DARK ? 'border-white/5 bg-slate-900/60' : 'border-slate-100 bg-slate-50/80'}`}>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{AdminI18n.t('settings.components.indexedSize')}</div>
            <div className={`mt-3 text-3xl font-bold tracking-tight ${theme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>
              {SystemBackupPageUtils.formatBytes(totalBytes)}
            </div>
            <p className="mt-2 text-xs text-slate-500">{AdminI18n.t('settings.components.visibleArchiveSizeAcrossCurrent')}</p>
          </div>

          <div className={`rounded-lg border p-5 ${theme === ThemeMode.DARK ? 'border-white/5 bg-slate-900/60' : 'border-slate-100 bg-slate-50/80'}`}>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{AdminI18n.t('settings.components.latestSnapshot')}</div>
            <div className={`mt-3 text-sm font-bold tracking-tight ${theme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>
              {latestBackup ? latestBackup.displayName : AdminI18n.t('settings.components.noSnapshotsYet')}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {latestBackup ? SystemBackupPageUtils.formatTimestamp(latestBackup.modifiedAt) : AdminI18n.t('settings.components.createASystemBackupTo')}
            </p>
          </div>
        </div>
      </div>
    </Card>
    );
  }
}