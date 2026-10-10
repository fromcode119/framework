import type { CollectionAccess } from '@/lib/collection-access';
import { ThemeMode } from '@fromcode119/core/client';
import type { MouseEvent, ReactNode } from 'react';
import Link from 'next/link';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { Slot, FrameworkIcons } from '@fromcode119/react';
import { Archive, ArchiveRestore, Copy, SlidersHorizontal } from 'lucide-react';
import { CollectionArchive } from '@fromcode119/core/client';
import { Dropdown } from '@/components/ui/view/dropdown.client';
import { HorizontalAlign } from '@/components/ui/enums/horizontal-align.enum';
import { DropdownItemVariant } from '@/components/ui/enums/dropdown-item-variant.enum';
import type { IDropdownItem } from '@/components/ui/interfaces/dropdown-item.interface';
import { AdminCollectionUtils } from '@/lib/collection-utils';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * A record's actions, each in exactly one place. In the table: open-on-site, duplicate, quick edit and
 * edit as icons, a plugin's own row actions beside them, and archive and delete in the ⋯ menu. On a
 * card, quick edit and edit stay in view and the menu also carries open-on-site and duplicate.
 */
export class CollectionListRowActions extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<CollectionListRowActions, 'row' | 'collection' | 'pluginSlug' | 'slug' | 'slotSlug' | 'resolvedSlug' | 'theme' | 'frontendUrl' | 'permalinkStructure' | 'pluginSettings' | 'quickEditExpandedId' | 'onQuickEditOpen' | 'onDelete' | 'onArchive' | 'onNavigate' | 'onRowChanged' | 'access' | 'compact'>;

  @prop declare row: any;
  @prop declare collection: any;
  @prop declare pluginSlug: string;
  @prop declare slug: string;
  @prop declare slotSlug: string;
  @prop declare resolvedSlug: string;
  @prop declare theme: ThemeMode;
  @prop declare frontendUrl: string;
  @prop declare permalinkStructure?: string;
  @prop declare pluginSettings: Record<string, any>;
  @prop declare quickEditExpandedId: string | null;
  @prop declare onQuickEditOpen: (row: any, event: MouseEvent) => void;
  @prop declare onDelete: (id: string) => void;
  @prop declare onArchive?: (id: string, archiving: boolean) => void;
  /** Goes to an admin path, as a link would — the menu's items are buttons, not links. */
  @prop declare onNavigate: (href: string) => void;
  /** Reloads the list — handed to a plugin's row action as `refresh`, for after it changed the record. */
  @prop declare onRowChanged: () => void;
  /** What the signed-in user may do to this record — decides which actions are offered. */
  @prop declare access: CollectionAccess;
  /** The card: the plugin's row actions, quick edit, edit and the menu — open-on-site and duplicate move into the menu. */
  @prop declare compact?: boolean;

  private static readonly ICON = 'inline-flex items-center justify-center w-9 h-9 rounded-lg transition-colors text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 dark:text-slate-500 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400';

  private get rowId(): string {
    return String(this.row?.id ?? '');
  }

  private get previewUrl(): string {
    if (!AdminCollectionUtils.supportsPreview(this.collection)) return '';
    return AdminCollectionUtils.generatePreviewUrl(this.frontendUrl, this.row, this.collection, this.permalinkStructure, this.pluginSettings);
  }

  private get duplicateHref(): string {
    return `/${this.pluginSlug}/${this.slug}/new?duplicateFrom=${encodeURIComponent(this.rowId)}`;
  }

  private get menuItems(): IDropdownItem[] {
    const items: IDropdownItem[] = [];
    const previewUrl = this.previewUrl;
    // On a card these two have no icon of their own, so the menu carries them; in the table they are
    // icons beside edit, and listing them again here showed every action twice.
    if (this.compact && previewUrl) items.push({ label: AdminI18n.t('collection.list.openOnSite'), icon: <FrameworkIcons.ExternalLink size={15} />, onClick: () => window.open(previewUrl, '_blank', 'noopener') });
    if (this.compact && this.access.canCreate) items.push({ label: AdminI18n.t('collection.list.duplicate'), icon: <Copy size={15} />, onClick: () => this.onNavigate(this.duplicateHref) });
    if (this.access.canUpdate && this.onArchive) {
      const archived = CollectionArchive.isArchived(this.row);
      items.push({
        label: AdminI18n.t(archived ? 'collection.list.restore' : 'collection.list.archive'),
        icon: archived ? <ArchiveRestore size={15} /> : <Archive size={15} />,
        onClick: () => this.onArchive?.(this.rowId, !archived),
      });
    }
    if (this.access.canDelete) {
      items.push({ label: AdminI18n.t('collection.list.delete'), icon: <FrameworkIcons.Trash size={15} />, variant: DropdownItemVariant.DANGER, onClick: () => this.onDelete(this.rowId) });
    }
    return items;
  }

  @bound private stop(event: MouseEvent): void {
    event.stopPropagation();
  }

  @bound private openQuickEdit(event: MouseEvent): void {
    this.onQuickEditOpen(this.row, event);
  }

  private renderWideOnly(): ReactNode {
    const previewUrl = this.previewUrl;
    return (
      <>
        {previewUrl ? (
          <a href={previewUrl} target="_blank" rel="noopener" onClick={this.stop} className={CollectionListRowActions.ICON} title={AdminI18n.t('collection.list.openOnSite')} aria-label={AdminI18n.t('collection.list.openOnSite')}>
            <FrameworkIcons.ExternalLink size={16} />
          </a>
        ) : null}
        {this.access.canCreate ? (
          <Link href={this.duplicateHref} onClick={this.stop} className={CollectionListRowActions.ICON} title={AdminI18n.t('collection.list.duplicate')} aria-label={AdminI18n.t('collection.list.duplicate')}>
            <Copy size={16} />
          </Link>
        ) : null}
      </>
    );
  }

  render(): ReactNode {
    const { row, collection, pluginSlug, resolvedSlug, slotSlug, access } = this;
    const expanded = this.quickEditExpandedId === this.rowId;
    const menuItems = this.menuItems;
    return (
      // Two groups that each stay on one line: on a narrow card the plugin's actions and the built-in
      // icons wrap as wholes, instead of the last icon dropping alone or the row running off the card.
      <div className={`ml-auto flex items-center justify-end gap-x-0.5 gap-y-1.5 whitespace-nowrap ${this.compact ? 'flex-wrap' : 'flex-nowrap'}`} onClick={this.stop}>
        {/* A plugin's own row actions — "Payment received" on an order — on a card as in the table: on a
            phone they are the fastest way to act on a record, and leaving them out hid them entirely. */}
        <span className="inline-flex flex-nowrap items-center gap-0.5 empty:hidden">
          <Slot name={`admin.collection.${slotSlug}.list.table.actions`} include={access.allowsPluginAction} props={{ row, collection, pluginSlug, resolvedSlug, compact: Boolean(this.compact), refresh: this.onRowChanged }} />
          <Slot name="admin.collection.list.table.actions" include={access.allowsPluginAction} props={{ row, collection, pluginSlug, resolvedSlug, compact: Boolean(this.compact), refresh: this.onRowChanged }} />
        </span>
        <span className="inline-flex flex-nowrap items-center gap-0.5">
        {!this.compact ? this.renderWideOnly() : null}
        {access.canUpdate ? (
          <button
            type="button"
            onClick={this.openQuickEdit}
            aria-expanded={expanded}
            className={expanded ? 'inline-flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300' : CollectionListRowActions.ICON}
            title={AdminI18n.t(expanded ? 'collection.list.quickEditClose' : 'collection.list.quickEditOpen')}
            aria-label={AdminI18n.t(expanded ? 'collection.list.quickEditClose' : 'collection.list.quickEditOpen')}
          >
            <SlidersHorizontal size={16} />
          </button>
        ) : null}
        <Link href={`/${pluginSlug}/${this.slug}/${row.id}`} onClick={this.stop} className={CollectionListRowActions.ICON} title={AdminI18n.t('collection.list.edit')} aria-label={AdminI18n.t('collection.list.edit')}>
          <FrameworkIcons.Edit size={16} />
        </Link>
        {menuItems.length ? (
          <Dropdown
            align={HorizontalAlign.RIGHT}
            items={menuItems}
            trigger={<span className={CollectionListRowActions.ICON} title={AdminI18n.t('collection.list.moreActions')} aria-label={AdminI18n.t('collection.list.moreActions')}><FrameworkIcons.More size={16} /></span>}
          />
        ) : null}
        </span>
      </div>
    );
  }
}
