import type { ReactNode } from 'react';
import { Reactor, bound, prop, state } from '@fromcode119/react-class-components';
import { ImportPlanRecord } from '@/app/sites/import/import-plan-record';
import { ImportPlanOutcome } from '@/app/sites/import/enums/import-plan-outcome.enum';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { EditSheet } from '@/components/ui/view/edit-sheet.client';

/**
 * One kind of record: what it is, how many, and whether it comes across.
 *
 * This replaced a row built from `LOWEST ID` / `HANDED OUT HERE` / a dump of column names. Those are
 * a proof that the import is correct, put in front of someone who cannot read them and was not
 * asking — re-numbering is invisible to an operator, because every reference moves with it. So the
 * row answers in sentences, and the mechanics stand beside them.
 *
 * The row OPENS, it does not unfold. Two folds used to sit inside this list - the row, and a
 * Technical fold inside the row - so the list jumped under the pointer twice for one answer and two
 * rows could never be read side by side. Everything the row has to say is in its panel: every id
 * figure, every followed and unfollowed link, every dropped column, all found by find-in-page. A row
 * with nothing to explain (arrives whole, ids untouched) does not open at all.
 */
export class ImportPlanRecordRow extends Reactor {
  @prop declare record: ImportPlanRecord;
  @state private open = false;

  @bound private toggle(): void {
    if (!this.canOpen) return;
    this.open = true;
  }

  @bound private close(): void {
    this.open = false;
  }

  /** A row earns a disclosure when it has something to say beyond its own summary line. */
  private get canOpen(): boolean {
    return this.record.outcome !== ImportPlanOutcome.FULL || this.record.sentences.length > 1;
  }

  private get toneClass(): string {
    const outcome = this.record.outcome;
    if (outcome === ImportPlanOutcome.NONE) return 'fc-import-rec__say--no';
    if (outcome === ImportPlanOutcome.PARTIAL) return 'fc-import-rec__say--part';
    return 'fc-import-rec__say--ok';
  }

  private renderTechnical(): ReactNode {
    const { record } = this;
    const { table } = record;
    const followed = record.followedLinks;
    return (
      <div className="fc-import-rec__techwrap">
        <h3 className="fc-import-rec__tech">{AdminI18n.t('sites.importPlan.technical')}</h3>
        <div className="fc-import-rec__techbox">
            <dl className="fc-import-rec__dl">
              <dt>{AdminI18n.t('sites.importPlan.table')}</dt><dd className="fc-import-rec__mono">{table.name}</dd>
              <dt>{AdminI18n.t('sites.importPlan.ids2')}</dt><dd>{record.idMechanics}</dd>
              {table.pluginSlug ? <><dt>{AdminI18n.t('sites.importPlan.ownedBy')}</dt><dd className="fc-import-rec__mono">{table.pluginSlug}</dd></> : null}
              {record.excludedRows > 0 ? <><dt>{AdminI18n.t('sites.importPlan.rowsExcluded')}</dt><dd>{AdminI18n.t('sites.importPlan.rowsExcludedValue', { count: record.excludedRows.toLocaleString() })}</dd></> : null}
              {followed.length ? (
                <><dt>{AdminI18n.t('sites.importPlan.linksFollowed')}</dt><dd className="fc-import-rec__mono"><ul>{followed.map((link) => <li key={link}>{link}</li>)}</ul></dd></>
              ) : null}
              {/* Listed whatever the mode — the column IS un-followed either way. What changes with the
                  mode is whether that matters, which the label says rather than leaving the reader to infer. */}
              {table.opaqueJsonColumns.length ? (
                <>
                  <dt>{record.hasUnfollowedLinks ? AdminI18n.t('sites.importPlan.linksNotFollowed') : AdminI18n.t('sites.importPlan.linksNotFollowedIdsUnchanged')}</dt>
                  <dd className={`fc-import-rec__mono${record.hasUnfollowedLinks ? ' fc-import-rec__lost' : ''}`}>
                    <ul>{table.opaqueJsonColumns.map((c) => <li key={c}>{c}</li>)}</ul>
                  </dd>
                </>
              ) : null}
              {table.droppedColumns.length ? (
                <><dt>{AdminI18n.t('sites.importPlan.columnsDropped')}</dt><dd className="fc-import-rec__mono fc-import-rec__lost"><ul>{table.droppedColumns.map((c) => <li key={c}>{c}</li>)}</ul></dd></>
              ) : null}
            </dl>
        </div>
      </div>
    );
  }

  render(): ReactNode {
    const { record } = this;
    return (
      <>
        <div
          className={`fc-import-rec__row${this.canOpen ? '' : ' fc-import-rec__row--flat'}`}
          onClick={this.toggle}
          role={this.canOpen ? 'button' : undefined}
          tabIndex={this.canOpen ? 0 : undefined}
          onKeyDown={(event) => { if (this.canOpen && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); this.toggle(); } }}
        >
          <span className="fc-import-rec__name">{record.name}</span>
          <span className="fc-import-rec__count">{record.arrivingRows.toLocaleString()}</span>
          <span className={`fc-import-rec__say ${this.toneClass}`}>
            <span className="fc-import-rec__dot" aria-hidden="true" />
            {record.answer}
          </span>
        </div>
        {this.open && this.canOpen ? (
          <EditSheet
            isOpen
            title={record.name}
            subtitle={record.answer}
            saveLabel={AdminI18n.t('common.close')}
            onClose={this.close}
            onSave={this.close}
          >
            <div className="fc-import-rec__detail">
              {record.sentences.map((sentence) => (
                <p key={sentence.text} className={sentence.warn ? 'fc-import-rec__line fc-import-rec__line--warn' : 'fc-import-rec__line'}>
                  {sentence.text}
                </p>
              ))}
              {this.renderTechnical()}
            </div>
          </EditSheet>
        ) : null}
      </>
    );
  }
}
