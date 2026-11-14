import { ExportFormat } from '@/components/collection/list/enums/export-format.enum';
import type { ChangeEvent, ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** Collection list footer (record count + export/import/API links). Pure presentational class. */
export class ListFooter extends PureReactor {
  @prop declare slug: string;
  @prop declare total: number;
  @prop declare resolvedSlug: string;
  @prop declare handleExport: (format: ExportFormat) => void;
  @prop declare handleImport: (e: ChangeEvent<HTMLInputElement>) => void;
  /** Import creates records, so it is offered only to a user who may create them. */
  @prop declare canCreate: boolean;

  render(): ReactNode {
    return (
      <div className="fc-list-actions">
        <div>
          <div className="fc-list-actions__row">
            {/* Was "Data Management Node // SLUG" over a pulsing dot, and "Connected to N records in
                the system cluster." Both implied a distributed cluster topology that does not exist —
                the same fabrication as the dashboard-footer "distributed cluster node" line. The
                record count is real, so it stays; the invented infrastructure around it does not. */}
            <p className="fc-list-actions__count">
              {AdminI18n.t(this.total === 1 ? 'collection.list.countOne' : 'collection.list.countMany', { count: this.total })}
            </p>

            <div className="flex items-center gap-3 text-xs font-semibold tracking-wide text-slate-400">
              <button
                onClick={() => this.handleExport(ExportFormat.JSON)}
                className="inline-flex min-h-6 items-center rounded-md px-1.5 hover:text-indigo-500 transition-colors"
              >
                {AdminI18n.t('collection.list.exportJson')}
              </button>
              {this.canCreate ? <>
                <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                <label className="inline-flex min-h-6 cursor-pointer items-center rounded-md px-1.5 hover:text-indigo-500 transition-colors">
                  {AdminI18n.t('collection.list.bulkImport')}
                  <input type="file" className="hidden" accept=".json" onChange={this.handleImport} />
                </label>
              </> : null}
              <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
              <a
                href={`${AdminApi.getBaseUrl()}${AdminConstants.ENDPOINTS.COLLECTIONS.BASE}/${this.resolvedSlug}`}
                target="_blank"
                className="inline-flex min-h-6 items-center rounded-md px-1.5 hover:text-indigo-500 transition-colors"
              >
                {AdminI18n.t('collection.list.apiEndpoint')}
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
