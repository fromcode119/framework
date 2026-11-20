import { ExportFormat } from '@/components/collection/list/enums/export-format.enum';
import type { ChangeEvent, ReactNode } from 'react';
import { PureReactor, bound, prop, state } from '@fromcode119/react-class-components';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { Dropdown } from '@/components/ui/view/dropdown.client';
import { HorizontalAlign } from '@/components/ui/enums/horizontal-align.enum';
import { ConfirmDialog } from '@/components/ui/view/confirm-dialog.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ListImportFile } from '@/components/collection/list/list-import-file';
import type { IListImportDraft } from '@/components/collection/list/interfaces/list-import-draft.interface';
import { NotificationContextStore } from '@/components/view/notification-context-store.client';
import type { INotificationContextType } from '@/components/interfaces/notification-context-type.interface';
import { NotificationType } from '@/components/enums/notification-type.enum';

/** Collection list footer (export/import/API links). */
export class ListFooter extends PureReactor {
  static contextType = NotificationContextStore.context;
  declare context: INotificationContextType | undefined;

  @prop declare slug: string;
  @prop declare resolvedSlug: string;
  @prop declare handleExport: (format: ExportFormat) => void;
  @prop declare importRecords: (records: unknown[]) => Promise<void>;
  /** Import creates records, so it is offered only to a user who may create them. */
  @prop declare canCreate: boolean;

  /** A file that was read and waits for the operator to say yes — nothing is created before that. */
  @state private draft: IListImportDraft | null = null;
  @state private importing = false;

  @bound
  private async pick(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const input = event.target;
    const file = input.files?.[0];
    // Cleared at once, so picking the same file again (after a cancel or a fix) is a change again.
    input.value = '';
    if (!file) return;
    const records = ListImportFile.records(await file.text());
    if (records) this.setState({ draft: { fileName: file.name, records } });
    else this.context?.notify(NotificationType.ERROR, AdminI18n.t('collection.list.importNoRecords', { file: file.name }), '');
  }

  @bound
  private async confirm(): Promise<void> {
    const draft = this.draft;
    if (!draft) return;
    this.setState({ importing: true });
    try {
      await this.importRecords(draft.records);
    } finally {
      this.setState({ importing: false, draft: null });
    }
  }

  @bound
  private cancel(): void {
    if (!this.importing) this.setState({ draft: null });
  }

  private static readonly LINK = 'inline-flex min-h-6 items-center rounded-md px-1.5 hover:text-indigo-500 transition-colors';

  private renderExport(): ReactNode {
    const link = ListFooter.LINK;
    return (
      <Dropdown
        align={HorizontalAlign.LEFT}
        items={[
          { label: AdminI18n.t('collection.list.exportCsv'), onClick: () => this.handleExport(ExportFormat.CSV) },
          { label: AdminI18n.t('collection.list.exportJsonFile'), onClick: () => this.handleExport(ExportFormat.JSON) },
        ]}
        trigger={<span role="button" tabIndex={0} className={link}>{AdminI18n.t('collection.list.exportJson')}</span>}
      />
    );
  }

  private renderDialogs(): ReactNode {
    if (!this.draft) return null;
    return (
      <ConfirmDialog isOpen onClose={this.cancel} onConfirm={this.confirm} isLoading={this.importing}
        title={AdminI18n.t('collection.list.importConfirmTitle', { count: this.draft.records.length, file: this.draft.fileName })}
        description={AdminI18n.t('collection.list.importConfirmDescription', { count: this.draft.records.length })}
        confirmLabel={AdminI18n.t('collection.list.bulkImport')} variant={ButtonVariant.PRIMARY} />
    );
  }

  render(): ReactNode {
    const link = ListFooter.LINK;
    return (
      <div className="fc-list-actions">
        <div>
          <div className="fc-list-actions__row">
            {/* The record count is NOT repeated here: the table's own footer already says it. What is left
                is what this row is for — the three ways out of the list. */}
            <div className="flex items-center gap-3 text-xs font-medium tracking-wide text-slate-400">
              {this.renderExport()}
              {this.canCreate ? <>
                <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                <label className={`${link} cursor-pointer`}>
                  {AdminI18n.t('collection.list.bulkImport')}
                  <input type="file" className="hidden" accept=".json,application/json" onChange={this.pick} />
                </label>
              </> : null}
              <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
              <a
                href={`${AdminApi.getBaseUrl()}${AdminConstants.ENDPOINTS.COLLECTIONS.BASE}/${this.resolvedSlug}`}
                target="_blank"
                className={link}
              >
                {AdminI18n.t('collection.list.apiEndpoint')}
              </a>
            </div>
          </div>
        </div>
        {this.renderDialogs()}
      </div>
    );
  }
}
