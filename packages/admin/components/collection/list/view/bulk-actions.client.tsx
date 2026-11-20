import type { CollectionAccess } from '@/lib/collection-access';
import { ExportFormat } from '@/components/collection/list/enums/export-format.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons, Slot } from '@fromcode119/react';
import { CommandBar } from '@/components/ui/view/command-bar.client';
import { CommandBarCommand } from '@/components/ui/view/command-bar-command.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { Archive, ArchiveRestore } from 'lucide-react';

export class BulkActions extends PureReactor {
  @prop declare theme: ThemeMode;
  @prop declare selectedIds: string[];
  @prop declare statusOptions: { label: string; value: string }[];
  @prop declare handleBulkStatusChange: (status: string) => void;
  @prop declare handleExport: (format: ExportFormat, ids?: string[]) => void;
  @prop declare handleBulkDelete: () => void;
  @prop declare archivable?: boolean;
  @prop declare showArchived?: boolean;
  /** Archives the selection, or restores it in the Archived view. */
  @prop declare handleBulkArchive?: () => void;
  @prop declare setSelectedIds: (ids: string[]) => void;
  // Domain-agnostic: a plugin can contribute its own action on the current selection (e.g. "create X from
  // selection") via a slot. The framework never knows what — it just forwards the selection + collection.
  @prop declare collection?: any;
  @prop declare slotSlug?: string;
  @prop declare resolvedSlug?: string;
  /** What the signed-in user may do to these records — status changes need update, delete needs delete. */
  @prop declare access: CollectionAccess;

  render(): ReactNode {
    const {
      selectedIds,
      statusOptions,
      handleBulkStatusChange,
      handleExport,
      handleBulkDelete,
      archivable,
      showArchived,
      handleBulkArchive,
      setSelectedIds,
      collection,
      slotSlug,
      resolvedSlug,
      access
    } = this;
    if (selectedIds.length === 0) return null;

    const slotProps = { selectedIds, collection, resolvedSlug, setSelectedIds };
    return (
      <CommandBar open value={AdminI18n.t('collection.list.selected', { count: selectedIds.length })}>
        {access.canUpdate
          ? statusOptions.map((option) => (
              <CommandBarCommand
                key={option.value}
                label={AdminI18n.t('collection.list.setStatus', { status: option.label || option.value })}
                onClick={() => handleBulkStatusChange(option.value)}
              />
            ))
          : null}
        <CommandBarCommand
          label={AdminI18n.t('common.export')}
          icon={<FrameworkIcons.Download size={15} />}
          onClick={() => handleExport(ExportFormat.JSON, selectedIds)}
        />
        {archivable && access.canUpdate && handleBulkArchive ? (
          <CommandBarCommand
            label={AdminI18n.t(showArchived ? 'collection.list.restore' : 'collection.list.archive')}
            icon={showArchived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
            onClick={handleBulkArchive}
          />
        ) : null}
        {access.canDelete ? (
          <CommandBarCommand label={AdminI18n.t('common.delete')} icon={<FrameworkIcons.Trash size={15} />} onClick={handleBulkDelete} />
        ) : null}
        {/* Plugin-contributed actions on the current selection (domain-agnostic — the owning plugin fills it). */}
        <Slot name={`admin.collection.${slotSlug}.list.bulk.actions`} include={access.allowsPluginAction} props={slotProps} />
        <Slot name="admin.collection.list.bulk.actions" include={access.allowsPluginAction} props={slotProps} />
        <CommandBarCommand
          label={<FrameworkIcons.Close size={15} />}
          title={AdminI18n.t('collection.list.clearSelection')}
          onClick={() => setSelectedIds([])}
        />
      </CommandBar>
    );
  }
}
