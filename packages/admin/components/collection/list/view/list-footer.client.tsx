import { ExportFormat } from '@/components/collection/list/enums/export-format.enum';
import type { ChangeEvent, ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** Collection list footer (record count + export/import/API links). Pure presentational class. */
export class ListFooter extends PureReactor {
  @prop declare slug: string;
  @prop declare resolvedSlug: string;
  @prop declare handleExport: (format: ExportFormat) => void;
  @prop declare handleImport: (e: ChangeEvent<HTMLInputElement>) => void;
  /** Import creates records, so it is offered only to a user who may create them. */
  @prop declare canCreate: boolean;

  render(): ReactNode {
    // The record count is NOT repeated here: the table's own footer already says "1 — 10 of 15" inside
    // the card. What this band is for is the three quiet ways out of the list — export, import, the raw
    // endpoint — drawn as the console's own secondary controls (icon + word, the row's height, the
    // hover fill), not the 12px grey text over 1px dots that read as debug output.
    return (
      <div className="fc-list-foot">
        <div className="fc-list-foot__actions">
          <button className="fc-list-foot__action" onClick={() => this.handleExport(ExportFormat.JSON)}>
            <FrameworkIcons.Download size={15} />
            {AdminI18n.t('collection.list.exportJson')}
          </button>
          {this.canCreate ? (
            <label className="fc-list-foot__action">
              <FrameworkIcons.Upload size={15} />
              {AdminI18n.t('collection.list.bulkImport')}
              <input type="file" className="hidden" accept=".json" onChange={this.handleImport} />
            </label>
          ) : null}
          <a
            className="fc-list-foot__action"
            href={`${AdminApi.getBaseUrl()}${AdminConstants.ENDPOINTS.COLLECTIONS.BASE}/${this.resolvedSlug}`}
            target="_blank"
          >
            <FrameworkIcons.Code size={15} />
            {AdminI18n.t('collection.list.apiEndpoint')}
          </a>
        </div>
      </div>
    );
  }
}
