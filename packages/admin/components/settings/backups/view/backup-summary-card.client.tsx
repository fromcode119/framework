import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Badge } from '@/components/ui/view/badge.client';
import { Card } from '@/components/ui/view/card.client';
import { FrameworkIcons } from '@fromcode119/react';
import { prop } from '@fromcode119/reactor';
import type { IBackupCatalogGroupView } from '@/components/settings/backups/interfaces/backup-catalog-group-view.interface';
import type { ISystemBackupCapabilities } from '@/components/settings/backups/interfaces/system-backup-capabilities.interface';
import { SystemBackupPageUtils } from '@/components/settings/backups/system-backup-page-utils';

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
                Backup Inventory
              </h2>
              <p className="text-sm text-slate-500">
                Review system snapshots, plugin archives, theme backups, and database dumps from one place.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant={capabilities.canManage ? 'success' : 'gray'}>
              {capabilities.canManage ? 'Create/Delete Enabled' : 'Read Only'}
            </Badge>
            <Badge variant={capabilities.canRestore ? 'warning' : 'gray'}>
              {capabilities.canRestore ? 'Restore Authorized' : 'Restore Restricted'}
            </Badge>
            <Badge variant={BadgeVariant.BLUE}>{totalBackups} items indexed</Badge>
          </div>
        </div>

        <div className="grid w-full gap-4 sm:grid-cols-3 lg:max-w-2xl">
          <div className={`rounded-lg border p-5 ${theme === ThemeMode.DARK ? 'border-white/5 bg-slate-900/60' : 'border-slate-100 bg-slate-50/80'}`}>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Total Backups</div>
            <div className={`mt-3 text-3xl font-bold tracking-tight ${theme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>{totalBackups}</div>
            <p className="mt-2 text-xs text-slate-500">Grouped inventory across managed backup roots.</p>
          </div>

          <div className={`rounded-lg border p-5 ${theme === ThemeMode.DARK ? 'border-white/5 bg-slate-900/60' : 'border-slate-100 bg-slate-50/80'}`}>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Indexed Size</div>
            <div className={`mt-3 text-3xl font-bold tracking-tight ${theme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>
              {SystemBackupPageUtils.formatBytes(totalBytes)}
            </div>
            <p className="mt-2 text-xs text-slate-500">Visible archive size across current listing results.</p>
          </div>

          <div className={`rounded-lg border p-5 ${theme === ThemeMode.DARK ? 'border-white/5 bg-slate-900/60' : 'border-slate-100 bg-slate-50/80'}`}>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Latest Snapshot</div>
            <div className={`mt-3 text-sm font-bold tracking-tight ${theme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>
              {latestBackup ? latestBackup.displayName : 'No snapshots yet'}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {latestBackup ? SystemBackupPageUtils.formatTimestamp(latestBackup.modifiedAt) : 'Create a system backup to seed this inventory.'}
            </p>
          </div>
        </div>
      </div>
    </Card>
    );
  }
}