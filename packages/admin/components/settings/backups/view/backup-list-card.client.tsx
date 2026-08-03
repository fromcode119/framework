import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { BackupCatalogGroupKey } from '@fromcode119/core';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { prop } from '@fromcode119/reactor';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Badge } from '@/components/ui/view/badge.client';
import { Button } from '@/components/ui/view/button.client';
import { Card } from '@/components/ui/view/card.client';
import { FrameworkIcons } from '@fromcode119/react';
import type { IBackupCatalogGroupView } from '@/components/settings/backups/interfaces/backup-catalog-group-view.interface';
import type { IBackupCatalogItemView } from '@/components/settings/backups/interfaces/backup-catalog-item-view.interface';
import type { IBackupDownloadProgressView } from '@/components/settings/backups/interfaces/backup-download-progress-view.interface';
import type { ISystemBackupCapabilities } from '@/components/settings/backups/interfaces/system-backup-capabilities.interface';
import { SystemBackupPageUtils } from '@/components/settings/backups/system-backup-page-utils';

export class BackupListCard extends AdminComponent {
  @prop declare groups: IBackupCatalogGroupView[];
  @prop declare capabilities: ISystemBackupCapabilities;
  @prop declare isRefreshing: boolean;
  @prop declare downloadProgress: IBackupDownloadProgressView | null;
  @prop declare activeDeleteId: string;
  @prop declare activePreviewId: string;
  @prop declare onRefresh: () => Promise<void>;
  @prop declare onDownload: (id: string) => Promise<void>;
  @prop declare onRequestDelete: (item: IBackupCatalogItemView) => void;
  @prop declare onRequestRestore: (item: IBackupCatalogItemView) => void;

  render(): ReactNode {
    const {
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
    } = this;
    const theme = this.theme;

    return (
    <Card noPadding className="overflow-hidden">
      <div className={`border-b px-8 py-6 ${theme === ThemeMode.DARK ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-white/80'}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className={`text-lg font-bold tracking-tight ${theme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>Managed Archives</h2>
            <p className="text-sm text-slate-500">
              System restore always requires a preview, a typed confirmation challenge, and a fresh rollback snapshot.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant={ButtonVariant.SECONDARY}
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
          <div className={`rounded-lg border px-5 py-4 ${theme === ThemeMode.DARK ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50/60'}`}>
            <div className="flex items-center justify-between gap-4 text-[11px] font-semibold text-slate-500">
              <span>{SystemBackupPageUtils.getDownloadProgressLabel(downloadProgress)}</span>
              <span>{SystemBackupPageUtils.getDownloadProgressDetail(downloadProgress)}</span>
            </div>
            <div className={`mt-3 h-2 overflow-hidden rounded-full ${theme === ThemeMode.DARK ? 'bg-slate-800' : 'bg-slate-100'}`}>
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
          <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${theme === ThemeMode.DARK ? 'bg-slate-900 text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
            <FrameworkIcons.Database size={28} />
          </div>
          <h3 className={`mt-5 text-xl font-bold tracking-tight ${theme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>No backups indexed yet</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
            Create a system backup to establish a rollback point before updates or restore operations.
          </p>
        </div>
      ) : (
        <div className="space-y-8 px-8 py-8">
          {groups.map((group) => (
            <section key={group.key.value} className="space-y-4">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className={`text-base font-bold tracking-tight ${theme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>{group.label}</h3>
                    <Badge variant={BadgeVariant.GRAY}>{group.items.length}</Badge>
                  </div>
                  <p className="text-sm text-slate-500">{SystemBackupPageUtils.getGroupDescription(group.key)}</p>
                </div>
              </div>

              <div className={`overflow-x-auto rounded-lg border ${theme === ThemeMode.DARK ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50/60'}`}>
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
                          <div className={`font-semibold tracking-tight ${theme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>{item.displayName}</div>
                          <div className="mt-1 text-xs text-slate-500">{item.filename}</div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <Badge variant={item.group === BackupCatalogGroupKey.SYSTEM ? 'blue' : item.group === BackupCatalogGroupKey.DATABASE ? 'amber' : 'gray'}>
                            {SystemBackupPageUtils.getScopeLabel(item)}
                          </Badge>
                        </td>
                        <td className="px-5 py-4 align-top text-sm text-slate-500">{SystemBackupPageUtils.formatTimestamp(item.modifiedAt)}</td>
                        <td className="px-5 py-4 align-top text-sm text-slate-500">{SystemBackupPageUtils.formatBytes(item.sizeBytes)}</td>
                        <td className="px-5 py-4 align-top text-sm text-slate-500">{SystemBackupPageUtils.getStorageLabel(item)}</td>
                        <td className="px-5 py-4 align-top">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              size={FieldSize.SM}
                              variant={ButtonVariant.OUTLINE}
                              className="rounded-lg uppercase tracking-[0.16em]"
                              icon={<FrameworkIcons.Download size={12} />}
                              disabled={downloadProgress?.activeId === item.id}
                              onClick={() => onDownload(item.id)}
                            >
                              {downloadProgress?.activeId === item.id ? SystemBackupPageUtils.getDownloadProgressLabel(downloadProgress) : 'Download'}
                            </Button>
                            {capabilities.canRestore && SystemBackupPageUtils.canRestore(item) ? (
                              <Button
                                size={FieldSize.SM}
                                variant={ButtonVariant.SECONDARY}
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
                                size={FieldSize.SM}
                                variant={ButtonVariant.DANGER}
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
}