'use client';

import { ThemeHooks } from '@/components/use-theme';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { FrameworkIcons } from '@/lib/icons';
import type { BackupSummaryCardProps } from './backups-page-client.interfaces';
import { SystemBackupPageUtils } from './system-backup-page-utils';

export function BackupSummaryCard({ groups, capabilities }: BackupSummaryCardProps) {
  const { theme } = ThemeHooks.useTheme();
  const totalBackups = SystemBackupPageUtils.totalBackups(groups);
  const totalBytes = SystemBackupPageUtils.totalBytes(groups);
  const latestBackup = SystemBackupPageUtils.getLatestBackup(groups);

  return (
    <Card className="border-0 rounded-[2rem] p-8 shadow-[0_24px_64px_-24px_rgba(15,23,42,0.22)] dark:ring-1 dark:ring-white/5">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${theme === 'dark' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
              <FrameworkIcons.Database size={24} />
            </div>
            <div>
              <h2 className={`text-lg font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
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
            <Badge variant="blue">{totalBackups} items indexed</Badge>
          </div>
        </div>

        <div className="grid w-full gap-4 sm:grid-cols-3 lg:max-w-2xl">
          <div className={`rounded-[1.5rem] border p-5 ${theme === 'dark' ? 'border-white/5 bg-slate-900/60' : 'border-slate-100 bg-slate-50/80'}`}>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Total Backups</div>
            <div className={`mt-3 text-3xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{totalBackups}</div>
            <p className="mt-2 text-xs text-slate-500">Grouped inventory across managed backup roots.</p>
          </div>

          <div className={`rounded-[1.5rem] border p-5 ${theme === 'dark' ? 'border-white/5 bg-slate-900/60' : 'border-slate-100 bg-slate-50/80'}`}>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Indexed Size</div>
            <div className={`mt-3 text-3xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {SystemBackupPageUtils.formatBytes(totalBytes)}
            </div>
            <p className="mt-2 text-xs text-slate-500">Visible archive size across current listing results.</p>
          </div>

          <div className={`rounded-[1.5rem] border p-5 ${theme === 'dark' ? 'border-white/5 bg-slate-900/60' : 'border-slate-100 bg-slate-50/80'}`}>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Latest Snapshot</div>
            <div className={`mt-3 text-sm font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
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