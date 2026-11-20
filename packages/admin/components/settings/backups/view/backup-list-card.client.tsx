import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { ReactNode } from 'react';
import { prop } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Badge } from '@/components/ui/view/badge.client';
import { Button } from '@/components/ui/view/button.client';
import { ListShell } from '@/components/ui/view/list-shell.client';
import { DataTable } from '@/components/ui/view/data-table.client';
import { EmptyState } from '@/components/ui/view/empty-state.client';
import { ProgressBar } from '@/components/ui/view/progress-bar.client';
import { Dropdown } from '@/components/ui/view/dropdown.client';
import { HorizontalAlign } from '@/components/ui/enums/horizontal-align.enum';
import { DropdownItemVariant } from '@/components/ui/enums/dropdown-item-variant.enum';
import { FrameworkIcons } from '@fromcode119/react';
import type { IBackupCatalogGroupView } from '@/components/settings/backups/interfaces/backup-catalog-group-view.interface';
import type { IBackupCatalogItemView } from '@/components/settings/backups/interfaces/backup-catalog-item-view.interface';
import type { IBackupDownloadProgressView } from '@/components/settings/backups/interfaces/backup-download-progress-view.interface';
import type { ISystemBackupCapabilities } from '@/components/settings/backups/interfaces/system-backup-capabilities.interface';
import { SystemBackupPageUtils } from '@/components/settings/backups/system-backup-page-utils';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

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

  private columns(): any[] {
    return [
      { header: AdminI18n.t('settings.components.backup'), id: 'backup', accessor: (item: IBackupCatalogItemView) => (
        <span className="fc-dt-inline"><span className="fc-dt-strong">{item.displayName}</span><span className="fc-dt-quiet">{item.filename}</span></span>
      ) },
      // `item.group` is a plain string on the wire; the utils hydrate it before choosing the tone.
      { header: AdminI18n.t('settings.components.scope'), id: 'scope', accessor: (item: IBackupCatalogItemView) => <Badge variant={SystemBackupPageUtils.getGroupBadgeVariant(item)}>{SystemBackupPageUtils.getScopeLabel(item)}</Badge> },
      { header: AdminI18n.t('settings.components.modified'), id: 'modified', accessor: (item: IBackupCatalogItemView) => SystemBackupPageUtils.formatTimestamp(item.modifiedAt) },
      { header: AdminI18n.t('settings.components.size'), id: 'size', accessor: (item: IBackupCatalogItemView) => SystemBackupPageUtils.formatBytes(item.sizeBytes) },
      { header: AdminI18n.t('settings.components.storage'), id: 'storage', accessor: (item: IBackupCatalogItemView) => SystemBackupPageUtils.getStorageLabel(item) },
    ];
  }

  /** What can be done with one archive: taken, put back, removed — the last two only where allowed. */
  private actions(item: IBackupCatalogItemView): ReactNode {
    const { capabilities, downloadProgress } = this;
    const items: any[] = [
      { label: AdminI18n.t('settings.components.download'), icon: <FrameworkIcons.Download size={15} />, onClick: () => { if (downloadProgress?.activeId !== item.id) void this.onDownload(item.id); } },
    ];
    if (capabilities.canRestore && SystemBackupPageUtils.canRestore(item)) {
      items.push({ label: AdminI18n.t('settings.components.restore'), icon: <FrameworkIcons.Refresh size={15} />, onClick: () => { if (this.activePreviewId !== item.id) this.onRequestRestore(item); } });
    }
    if (capabilities.canManage && SystemBackupPageUtils.canDelete(item)) {
      items.push({ label: AdminI18n.t('settings.components.delete'), icon: <FrameworkIcons.Trash size={15} />, variant: DropdownItemVariant.DANGER, onClick: () => { if (this.activeDeleteId !== item.id) this.onRequestDelete(item); } });
    }
    return <Dropdown align={HorizontalAlign.RIGHT} items={items} trigger={<span className="fc-record-card__menu" aria-label={AdminI18n.t('settings.components.actions')}><FrameworkIcons.More size={15} /></span>} />;
  }

  render(): ReactNode {
    const { groups, downloadProgress } = this;
    const refresh = <Button variant={ButtonVariant.SECONDARY} isLoading={this.isRefreshing} onClick={() => void this.onRefresh()}>{AdminI18n.t('settings.components.refreshInventory')}</Button>;
    const progress = downloadProgress ? (
      <div className="fc-list-band">
        <ProgressBar value={downloadProgress.percent ?? null} label={SystemBackupPageUtils.getDownloadProgressLabel(downloadProgress)} detail={SystemBackupPageUtils.getDownloadProgressDetail(downloadProgress)} />
      </div>
    ) : null;
    if (!groups.length) {
      return (
        <ListShell title={AdminI18n.t('settings.components.managedArchives')} subtitle={AdminI18n.t('settings.components.systemRestoreAlwaysRequiresA')} actions={refresh}>
          {progress}
          <EmptyState icon={<FrameworkIcons.Database size={18} />} title={AdminI18n.t('settings.components.noBackupsIndexedYet')} hint={AdminI18n.t('settings.components.createASystemBackupTo2')} />
        </ListShell>
      );
    }
    // One list card a kind of archive, the first carrying the page's own name and the refresh.
    return (
      <div className="fc-columns__stack">
        <ListShell title={AdminI18n.t('settings.components.managedArchives')} subtitle={AdminI18n.t('settings.components.systemRestoreAlwaysRequiresA')} actions={refresh}>
          {progress}
        </ListShell>
        {groups.map((group) => (
          <ListShell key={group.key.value} title={group.label} count={group.items.length} subtitle={SystemBackupPageUtils.getGroupDescription(group.key)}>
            <DataTable columns={this.columns()} data={group.items} actions={(item: IBackupCatalogItemView) => this.actions(item)} />
          </ListShell>
        ))}
      </div>
    );
  }
}
