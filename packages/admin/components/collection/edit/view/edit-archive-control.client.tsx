import { ThemeMode, CollectionArchive } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { Reactor, prop, state, bound } from '@fromcode119/react-class-components';
import { Archive, ArchiveRestore } from 'lucide-react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { NotificationContextStore } from '@/components/view/notification-context-store.client';
import type { INotificationContextType } from '@/components/interfaces/notification-context-type.interface';
import { ArchiveOperations } from '@/components/collection/list/archive-operations';

/**
 * Archive / Restore on the edit page of an archivable record, next to Delete.
 *
 * An archived record opened from the Archived view — or from a bookmark — says so in the header, and
 * Restore is the one click that brings it (and whatever it archived along with it) back.
 */
export class EditArchiveControl extends Reactor {
  static contextType = NotificationContextStore.context;
  declare context: INotificationContextType | undefined;

  @prop declare collection: any;
  @prop declare id: string;
  @prop declare theme: ThemeMode;
  @prop declare formData: any;
  @prop declare setFormData: (value: any) => void;

  @state private busy = false;

  @bound
  private async toggle(): Promise<void> {
    const archiving = !CollectionArchive.isArchived(this.formData);
    this.busy = true;
    try {
      const result = await ArchiveOperations.run(this.collection.slug, [this.id], archiving);
      const { title, message } = ArchiveOperations.summary(result, archiving);
      // Read the stamp back rather than guessing it: the sidebar shows exactly what was stored.
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
      this.busy = false;
    }
  }

  render(): ReactNode {
    const archived = CollectionArchive.isArchived(this.formData);
    const dark = this.theme === ThemeMode.DARK;
    const label = AdminI18n.t(archived ? 'collection.list.restore' : 'collection.list.archive');
    return (
      <div className="flex items-center gap-2">
        {archived ? (
          <span className={`h-10 px-3 inline-flex items-center rounded-[var(--radius)] border text-[10px] font-semibold ${
            dark ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-amber-200 bg-amber-50 text-amber-700'
          }`}>
            {AdminI18n.t('collection.list.viewArchived')}
          </span>
        ) : null}
        <button
          type="button"
          onClick={this.toggle}
          disabled={this.busy}
          title={label}
          aria-label={label}
          className={`h-10 px-4 inline-flex items-center justify-center gap-2 rounded-[var(--radius)] border text-[10px] font-semibold transition-all shadow-sm disabled:opacity-50 ${
            dark
              ? 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-amber-500/50 hover:text-white'
              : 'bg-white border-slate-200 text-slate-700 hover:border-amber-500'
          }`}
        >
          {archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
          {label}
        </button>
      </div>
    );
  }
}
