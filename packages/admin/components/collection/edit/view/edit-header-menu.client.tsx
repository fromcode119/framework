import type { ReactNode } from 'react';
import { Reactor, prop, state, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { Archive, ArchiveRestore } from 'lucide-react';
import { CollectionArchive } from '@fromcode119/core/client';
import { Dropdown } from '@/components/ui/view/dropdown.client';
import { HorizontalAlign } from '@/components/ui/enums/horizontal-align.enum';
import { DropdownItemVariant } from '@/components/ui/enums/dropdown-item-variant.enum';
import type { IDropdownItem } from '@/components/ui/interfaces/dropdown-item.interface';
import { AdminApi } from '@/lib/api';
import { AdminClass } from '@/lib/admin-class';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { NotificationContextStore } from '@/components/view/notification-context-store.client';
import type { INotificationContextType } from '@/components/interfaces/notification-context-type.interface';
import { ArchiveOperations } from '@/components/collection/list/archive-operations';
import { CollectionEditRecordMore } from '@/components/collection/edit/view/collection-edit-record-more.client';

/**
 * The record's ⋯ menu: what is done TO the record rather than to one of its parts — its status, how it
 * is shown (form or JSON), archiving and deleting. Each part's own editing stays on its card.
 *
 * Every entry is offered only when this user may do it and the record allows it; with none, no button.
 */
export class EditHeaderMenu extends Reactor {
  static contextType = NotificationContextStore.context;
  declare context: INotificationContextType | undefined;

  @prop declare collection: any;
  @prop declare id: string;
  @prop declare formData: any;
  @prop declare setFormData: (value: any) => void;
  @prop declare statusOptions: { label: string; value: string }[];
  @prop declare currentStatusValue: string;
  @prop declare onStatusChange: (value: string) => void;
  @prop declare advancedView: boolean;
  @prop declare setAdvancedView: (next: boolean) => void;
  @prop declare canArchive: boolean;
  @prop declare canDelete: boolean;
  @prop declare onDelete: () => void;

  /** Sections holding fields the record does not draw: one row each, opening the section on its own page. */
  @prop declare moreSections: Array<{ key: string; title: string; count: number }>;
  /** The record's own address; a row adds `?section=<key>` to it. */
  @prop declare recordHref: string;
  @prop declare navigate?: (href: string) => void;

  @state private archiving = false;

  @bound
  private async toggleArchive(): Promise<void> {
    if (this.archiving) return;
    const archiving = !CollectionArchive.isArchived(this.formData);
    this.archiving = true;
    try {
      const result = await ArchiveOperations.run(this.collection.slug, [this.id], archiving);
      const { title, message } = ArchiveOperations.summary(result, archiving);
      // Read the stamp back rather than guessing it: the page shows exactly what was stored.
      const stored = await AdminApi.get(AdminConstants.ENDPOINTS.COLLECTIONS.DETAIL(this.collection.slug, this.id));
      this.setFormData((previous: any) => ({
        ...previous,
        [CollectionArchive.ARCHIVED_AT]: stored?.[CollectionArchive.ARCHIVED_AT] ?? null,
        [CollectionArchive.ARCHIVED_WITH]: stored?.[CollectionArchive.ARCHIVED_WITH] ?? null,
      }));
      this.context?.notify(NotificationType.SUCCESS, title, message);
    } catch (error: any) {
      const message = AdminI18n.t(archiving ? 'collection.list.archiveFailed' : 'collection.list.restoreFailed', {
        message: error?.message || AdminI18n.t('common.unknownError'),
      });
      this.context?.notify(NotificationType.ERROR, message, '');
    } finally {
      this.archiving = false;
    }
  }

  /** What plugins add to the record's menu (`edit.header.menu`), drawn as rows under the record's own. */
  @prop declare actions?: ReactNode;

  private get items(): IDropdownItem[] {
    const items: IDropdownItem[] = this.statusOptions.map((option, index) => ({
      label: option.label,
      section: index === 0 ? AdminI18n.t('collection.edit.statusSection') : undefined,
      selectable: true,
      selected: option.value === this.currentStatusValue,
      onClick: () => this.onStatusChange(option.value),
    }));
    items.push(...this.pageItems());
    items.push({
      label: AdminI18n.t(this.advancedView ? 'collection.edit.showForm' : 'collection.edit.showJson'),
      section: items.length > 0 ? AdminI18n.t('collection.edit.recordSection') : undefined,
      icon: this.advancedView ? <FrameworkIcons.List size={15} /> : <FrameworkIcons.Code size={15} />,
      onClick: () => this.setAdvancedView(!this.advancedView),
    });
    if (this.canArchive) {
      const archived = CollectionArchive.isArchived(this.formData);
      items.push({
        label: AdminI18n.t(archived ? 'collection.list.restore' : 'collection.list.archive'),
        icon: archived ? <ArchiveRestore size={15} /> : <Archive size={15} />,
        onClick: () => void this.toggleArchive(),
      });
    }
    if (this.canDelete) {
      items.push({ label: AdminI18n.t('common.delete'), icon: <FrameworkIcons.Trash size={15} />, variant: DropdownItemVariant.DANGER, onClick: this.onDelete });
    }
    return items;
  }

  /**
   * "More": every section the record does not draw, by title and how many fields it adds, and the record's
   * history (when it was made and changed, and its versions). Each opens on its own page; nothing folds
   * open in place and nothing is out of reach.
   */
  private pageItems(): IDropdownItem[] {
    if (!this.recordHref || !this.navigate) return [];
    const open = (key: string) => () => this.navigate?.(`${this.recordHref}?${CollectionEditRecordMore.PARAM}=${encodeURIComponent(key)}`);
    const rows: IDropdownItem[] = this.moreSections.map((section) => ({
      label: section.title,
      detail: AdminI18n.t(section.count === 1 ? 'collection.edit.moreOneField' : 'collection.edit.moreFields', { count: section.count }),
      icon: <FrameworkIcons.Right size={15} />,
      onClick: open(section.key),
    }));
    rows.push({ label: AdminI18n.t('collection.edit.versions'), icon: <FrameworkIcons.Clock size={15} />, onClick: open(CollectionEditRecordMore.HISTORY) });
    rows[0].section = AdminI18n.t('collection.edit.more');
    return rows;
  }

  render(): ReactNode {
    const label = AdminI18n.t('collection.edit.recordActions');
    return (
      <Dropdown
        align={HorizontalAlign.RIGHT}
        items={this.items}
        footer={this.actions}
        trigger={
          <span role="button" tabIndex={0} aria-label={label} title={label} className={AdminClass.of('record-head__menu')}>
            <FrameworkIcons.More size={18} />
          </span>
        }
      />
    );
  }
}
