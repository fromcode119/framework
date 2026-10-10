import { ThemeMode } from '@fromcode119/core/client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import type { Dispatch, KeyboardEvent, ReactNode, SetStateAction } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { FieldRenderer } from '@/components/collection/view/field-renderer.client';
import { QuickEditField } from '@/components/collection/list/quick-edit-field';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The form that opens under a row: the fields the collection declared in `admin.list.quickEdit.row`,
 * each with its own control and width, saved together without leaving the list.
 */
export class CollectionQuickEditCard extends PureReactor {
  @prop declare row: any;
  @prop declare collection: any;
  @prop declare resolvedSlug: string;
  @prop declare quickEditFields: readonly QuickEditField[];
  @prop declare quickEditData: Record<string, any>;
  @prop declare setQuickEditData: Dispatch<SetStateAction<Record<string, any>>>;
  @prop declare quickEditStatus: { type: NotificationType; message: string } | null;
  @prop declare isLoadingRow: boolean;
  @prop declare isSavingRow: boolean;
  @prop declare onSave: () => void;
  @prop declare onClose: () => void;
  @prop declare theme: ThemeMode;
  @prop declare pluginSettings: Record<string, any>;

  /**
   * A control that shows or computes from several fields — the order totals panel — reads the whole
   * record and patches its siblings, as it does on the edit page. Without the record it summed
   * nothing and showed a total of 0.00 under a subtotal of 37.
   */
  @bound private patchRecord(partial: Record<string, any>): void {
    this.setQuickEditData((prev) => ({ ...prev, ...partial }));
  }

  @bound private handleKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.onClose();
    if (event.key === 'Enter' && (event.target as HTMLElement).tagName === 'INPUT') {
      event.preventDefault();
      this.onSave();
    }
  }

  private renderStatus(): ReactNode {
    const status = this.quickEditStatus;
    if (!status) return null;
    const tone = status.type === NotificationType.SUCCESS
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30'
      : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30';
    return <div className={`mb-4 rounded-xl border px-4 py-2.5 text-[13px] font-semibold ${tone}`}>{status.message}</div>;
  }

  private renderFields(): ReactNode {
    if (this.isLoadingRow) {
      return <div className="py-10 text-center text-sm font-semibold text-slate-500">{AdminI18n.t('collection.quickEdit.loading')}</div>;
    }
    if (!this.quickEditFields.length) {
      return <div className="py-6 text-center text-sm font-semibold text-slate-500">{AdminI18n.t('collection.quickEdit.noFields')}</div>;
    }
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">
        {this.quickEditFields.map((entry) => (
          <div key={entry.name} className={`min-w-0 ${entry.spanClass}`}>
            <FieldRenderer
              field={entry.field}
              value={this.quickEditData[entry.name]}
              onChange={(nextValue) => this.setQuickEditData((prev) => ({ ...prev, [entry.name]: nextValue }))}
              theme={this.theme as any}
              collectionSlug={this.resolvedSlug}
              pluginSettings={this.pluginSettings}
              isNew={false}
              record={this.quickEditData}
              onPatch={this.patchRecord}
            />
          </div>
        ))}
      </div>
    );
  }

  render(): ReactNode {
    return (
      <div onKeyDown={this.handleKey} onClick={(event) => event.stopPropagation()} className="px-1 py-1 sm:px-2">
        {this.renderStatus()}
        {this.renderFields()}
        <div className="mt-4 flex flex-col-reverse sm:flex-row sm:items-center gap-2">
          <p className="hidden sm:block flex-1 text-[12px] font-medium text-slate-400">{AdminI18n.t('collection.quickEdit.hint')}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={this.onClose}
              className="flex-1 sm:flex-none h-9 px-4 rounded-lg border text-[13px] font-semibold bg-white border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {AdminI18n.t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={this.onSave}
              disabled={this.isLoadingRow || this.isSavingRow}
              className="flex-1 sm:flex-none h-9 px-4 rounded-lg text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              <FrameworkIcons.Save size={14} />
              {AdminI18n.t(this.isSavingRow ? 'collection.quickEdit.saving' : 'collection.quickEdit.saveChanges')}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
