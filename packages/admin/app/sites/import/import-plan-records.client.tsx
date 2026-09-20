import type { ReactNode } from 'react';
import { Reactor, bound, prop, state } from '@fromcode119/react-class-components';
import { ImportPlanRecord } from '@/app/sites/import/import-plan-record';
import { ImportPlanRecordRow } from '@/app/sites/import/import-plan-record-row.client';
import { ImportPlanOutcome } from '@/app/sites/import/enums/import-plan-outcome.enum';
import { ImportPlanGrouping } from '@/app/sites/import/import-plan-groups';

/**
 * Everything the archive holds, grouped by the ANSWER rather than by the mechanism.
 *
 * The four groups this replaced — Not imported, Re-numbered, Ids kept, Empty — are the planner's
 * own vocabulary, and three of the four are about ids. An operator reading "Re-numbered: 12" learns
 * nothing they can act on, while the two kinds that will not turn up at all sit below a paragraph
 * about id sequences. So the buckets are now: does not come across, comes across with something
 * missing, comes across in full — worst first, because that is the only part that needs a decision.
 *
 * Every non-empty kind keeps its own line; nothing is summarised away. The empty ones are behind one
 * toggle because a table with no rows is a no-op in every mode, and naming 62 of them at full weight
 * is what buried the five that mattered.
 */
export class ImportPlanRecords extends Reactor {
  @prop declare records: ImportPlanRecord[];
  @state private query = '';
  @state private showEmpty = false;

  @bound private onQuery(event: { target: { value: string } }): void {
    this.query = event.target.value;
  }

  @bound private toggleEmpty(): void {
    this.showEmpty = !this.showEmpty;
  }

  /** Matches the name an operator can actually see, and the physical one a developer would search for. */
  private get matching(): ImportPlanRecord[] {
    const query = this.query.trim().toLowerCase();
    if (!query) return this.records;
    return this.records.filter((record) => record.name.toLowerCase().includes(query) || record.table.name.toLowerCase().includes(query));
  }

  /**
   * Biggest first, but a journal never ahead of a thing the shop has.
   *
   * A journal is a record of what happened — audit entries, request logs, sessions. It outnumbers
   * everything a shop actually owns: on a real archive 13,722 audit rows and 2,153 request logs
   * headed this group, pushing the orders and invoices the reader came for below the fold. Which
   * kinds those are is DECLARED by the collection that owns them, never guessed from a name or a row
   * count, and the same flag already keeps them from heading the tiles above.
   */
  private of(outcome: ImportPlanOutcome): ImportPlanRecord[] {
    return this.matching
      .filter((record) => !record.isEmpty && record.outcome === outcome)
      .sort((a, b) => {
        if (a.table.isJournal !== b.table.isJournal) return a.table.isJournal ? 1 : -1;
        return b.arrivingRows - a.arrivingRows;
      });
  }

  private static group(modifier: string, mark: string, title: string, records: ImportPlanRecord[]): ReactNode {
    if (!records.length) return null;
    const rows = records.reduce((sum, record) => sum + (record.outcome === ImportPlanOutcome.NONE ? record.table.rows : record.arrivingRows), 0);
    return (
      <>
        <div className={`fc-import-rec__group fc-import-rec__group--${modifier}`}>
          <span className="fc-import-rec__group-mark" aria-hidden="true">{mark}</span>
          <b>{title}</b>
          <span className="fc-import-rec__group-count">
            {records.length.toLocaleString()} kind(s) · {rows.toLocaleString()} record(s)
          </span>
        </div>
        {records.map((record) => <ImportPlanRecordRow key={record.table.name} record={record} />)}
      </>
    );
  }

  /** Named by owning plugin, exactly as the old "Empty" group named them — the same grouping rule, folded. */
  private renderEmpty(): ReactNode {
    const empty = this.matching.filter((record) => record.isEmpty);
    if (!empty.length) return null;
    const groups = ImportPlanGrouping.byPlugin(empty.map((record) => record.table));
    return (
      <>
        <div className="fc-import-rec__fold" onClick={this.toggleEmpty} role="button" tabIndex={0} aria-expanded={this.showEmpty}
          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.toggleEmpty(); } }}>
          <span><b>{empty.length.toLocaleString()} kind(s) are empty</b> in this archive — nothing to bring across</span>
          <span className="fc-import-rec__fold-action">{this.showEmpty ? 'hide' : 'show'}</span>
        </div>
        {this.showEmpty ? (
          <div className="fc-import-rec__foldbox">
            {groups.map((group) => (
              <p key={group.key} className="fc-import-rec__foldline">
                <strong>{group.key}</strong> — {group.tables.map((table) => table.label ?? table.name).join(', ')}
              </p>
            ))}
          </div>
        ) : null}
      </>
    );
  }

  render(): ReactNode {
    const none = this.of(ImportPlanOutcome.NONE);
    const partial = this.of(ImportPlanOutcome.PARTIAL);
    const full = this.of(ImportPlanOutcome.FULL);
    const nothing = !none.length && !partial.length && !full.length && !this.matching.some((record) => record.isEmpty);

    return (
      <div className="fc-import-rec">
        <p className="fc-import-rec__intro">
          Everything the archive holds, and whether it comes across. Anything that does not, or that arrives with
          something missing, is at the top.
        </p>
        <div className="fc-import-rec__bar">
          <input
            className="fc-import-rec__search"
            type="search"
            value={this.query}
            onChange={this.onQuery}
            placeholder="Find something — orders, pages, customers…"
            aria-label="Filter the kinds of record"
          />
        </div>
        {nothing ? <p className="fc-import-rec__intro">Nothing matches “{this.query}”.</p> : null}
        {ImportPlanRecords.group('no', '✕', 'Does not come across', none)}
        {ImportPlanRecords.group('part', '!', 'Comes across, with something missing', partial)}
        {ImportPlanRecords.group('ok', '✓', 'Comes across in full', full)}
        {this.renderEmpty()}
      </div>
    );
  }
}
