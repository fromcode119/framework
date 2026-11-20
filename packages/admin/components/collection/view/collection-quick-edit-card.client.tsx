import { ThemeMode } from '@fromcode119/core/client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import type { Dispatch, KeyboardEvent, ReactNode, SetStateAction } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { FieldRenderer } from '@/components/collection/view/field-renderer.client';
import { QuickEditField } from '@/components/collection/list/quick-edit-field';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { Alert } from '@/components/ui/view/alert.client';
import { Loader } from '@/components/ui/view/loader.client';
import { EmptyState } from '@/components/ui/view/empty-state.client';

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
    return <Alert tone={status.type === NotificationType.SUCCESS ? 'success' : 'danger'} className="mb-4">{status.message}</Alert>;
  }

  private renderFields(): ReactNode {
    if (this.isLoadingRow) {
      return <Loader label={AdminI18n.t('collection.quickEdit.loading')} />;
    }
    if (!this.quickEditFields.length) {
      return <EmptyState inline title={AdminI18n.t('collection.quickEdit.noFields')} />;
    }
    return (
      <div className="fc-quick-edit__grid">
        {this.quickEditFields.map((entry) => (
          <div key={entry.name} className="fc-quick-edit__cell" data-wide={entry.span >= 2 ? 'true' : undefined}>
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
      <div onKeyDown={this.handleKey} onClick={(event) => event.stopPropagation()} className="fc-quick-edit">
        {this.renderStatus()}
        {this.renderFields()}
      </div>
    );
  }
}
