'use client';

import { ThemeHooks } from '@/components/use-theme';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FrameworkIcons } from '@/lib/icons';
import type { BackupListCardProps } from './backups-page-client.interfaces';
import { SystemBackupPageUtils } from './system-backup-page-utils';

export function BackupListCard({
  groups,
  capabilities,
  isRefreshing,
  downloadProgress,
  activeDeleteId,
  activePreviewId,
  onRefresh,
  onDownload,
  onRequestDelete,
  onRequestRestore,
}: BackupListCardProps) {
  const { theme } = ThemeHooks.useTheme();

  return (
    <Card className="border-0 rounded-[2rem] p-0 overflow-hidden shadow-[0_24px_64px_-24px_rgba(15,23,42,0.18)] dark:ring-1 dark:ring-white/5">
      <div className={`border-b px-8 py-6 ${theme === 'dark' ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-white/80'}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className={`text-lg font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Managed Archives</h2>
            <p className="text-sm text-slate-500">
              System restore always requires a preview, a typed confirmation challenge, and a fresh rollback snapshot.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              className="rounded-xl px-5 uppercase tracking-[0.16em]"
              isLoading={isRefreshing}
              onClick={() => void onRefresh()}
            >
              Refresh Inventory
            </Button>
          </div>
        </div>
      </div>

      {downloadProgress ? (
        <div className="px-8 pt-6">
          <div className={`rounded-[1.5rem] border px-5 py-4 ${theme === 'dark' ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50/60'}`}>
            <div className="flex items-center justify-between gap-4 text-[11px] font-semibold text-slate-500">
              <span>{SystemBackupPageUtils.getDownloadProgressLabel(downloadProgress)}</span>
              <span>{SystemBackupPageUtils.getDownloadProgressDetail(downloadProgress)}</span>
            </div>
            <div className={`mt-3 h-2 overflow-hidden rounded-full ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
              <div
                className="h-full rounded-full bg-indigo-600 transition-[width] duration-200"
                style={{ width: `${downloadProgress.percent ?? 12}%` }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {!groups.length ? (
        <div className="px-8 py-16 text-center">
          <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${theme === 'dark' ? 'bg-slate-900 text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
            <FrameworkIcons.Database size={28} />
          </div>
          <h3 className={`mt-5 text-xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>No backups indexed yet</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
            Create a system backup to establish a rollback point before updates or restore operations.
          </p>
        </div>
      ) : (
        <div className="space-y-8 px-8 py-8">
          {groups.map((group) => (
            <section key={group.key} className="space-y-4">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className={`text-base font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{group.label}</h3>
                    <Badge variant="gray">{group.items.length}</Badge>
                  </div>
                  <p className="text-sm text-slate-500">{SystemBackupPageUtils.getGroupDescription(group.key)}</p>
                </div>
              </div>

              <div className={`overflow-x-auto rounded-[1.5rem] border ${theme === 'dark' ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50/60'}`}>
                <table className="min-w-full divide-y divide-slate-200/80 text-left dark:divide-slate-800">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      <th className="px-5 py-4 font-bold">Backup</th>
                      <th className="px-5 py-4 font-bold">Scope</th>
                      <th className="px-5 py-4 font-bold">Modified</th>
                      <th className="px-5 py-4 font-bold">Size</th>
                      <th className="px-5 py-4 font-bold">Storage</th>
                      <th className="px-5 py-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800">
                    {group.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-5 py-4 align-top">
                          <div className={`font-semibold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{item.displayName}</div>
                          <div className="mt-1 text-xs text-slate-500">{item.filename}</div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <Badge variant={item.group === 'system' ? 'blue' : item.group === 'database' ? 'amber' : 'gray'}>
                            {SystemBackupPageUtils.getScopeLabel(item)}
                          </Badge>
                        </td>
                        <td className="px-5 py-4 align-top text-sm text-slate-500">{SystemBackupPageUtils.formatTimestamp(item.modifiedAt)}</td>
                        <td className="px-5 py-4 align-top text-sm text-slate-500">{SystemBackupPageUtils.formatBytes(item.sizeBytes)}</td>
                        <td className="px-5 py-4 align-top text-sm text-slate-500">{SystemBackupPageUtils.getStorageLabel(item)}</td>
                        <td className="px-5 py-4 align-top">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-lg uppercase tracking-[0.16em]"
                              icon={<FrameworkIcons.Download size={12} />}
                              disabled={downloadProgress?.activeId === item.id}
                              onClick={() => onDownload(item.id)}
                            >
                              {downloadProgress?.activeId === item.id ? SystemBackupPageUtils.getDownloadProgressLabel(downloadProgress) : 'Download'}
                            </Button>
                            {capabilities.canRestore && SystemBackupPageUtils.canRestore(item) ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="rounded-lg uppercase tracking-[0.16em]"
                                icon={<FrameworkIcons.Refresh size={12} />}
                                isLoading={activePreviewId === item.id}
                                onClick={() => onRequestRestore(item)}
                              >
                                Restore
                              </Button>
                            ) : null}
                            {capabilities.canManage && SystemBackupPageUtils.canDelete(item) ? (
                              <Button
                                size="sm"
                                variant="danger"
                                className="rounded-lg uppercase tracking-[0.16em]"
                                icon={<FrameworkIcons.Trash size={12} />}
                                isLoading={activeDeleteId === item.id}
                                onClick={() => onRequestDelete(item)}
                              >
                                Delete
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}