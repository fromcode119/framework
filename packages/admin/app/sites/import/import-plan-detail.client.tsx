import type { ReactNode } from 'react';
import { Reactor, bound, prop, state } from '@fromcode119/react-class-components';
import { ImportPlanRecord } from '@/app/sites/import/import-plan-record';
import { ImportPlanRecords } from '@/app/sites/import/import-plan-records.client';
import { ImportPlanInventory } from '@/app/sites/import/import-plan-inventory.client';
import { ImportPlanDetailTab } from '@/app/sites/import/enums/import-plan-detail-tab.enum';

/**
 * The four things a reader might want to check, as one row of chips with one panel open at a time.
 *
 * They used to be three separate `<details>` stacked at the foot of the card — technical detail,
 * warnings, notes from the export — each folded, each looking like a debug leftover, and each giving
 * no clue how much was inside. A chip carries its own count, so the decision to open one is made
 * before opening it, and only one panel is open at once so the card never grows three screens tall.
 *
 * Every one of them is still on the page and still unfolds to the same content: this is presentation
 * of what was already reachable, never a reduction of it.
 */
export class ImportPlanDetail extends Reactor {
  @prop declare records: ImportPlanRecord[];
  @prop declare plugins: Array<Record<string, any>>;
  @prop declare theme: Record<string, any> | null;
  @prop declare warnings: string[];
  @prop declare exportWarnings: string[];
  @state private tab: ImportPlanDetailTab | null = null;

  @bound private select(tab: ImportPlanDetailTab): void {
    this.tab = this.tab === tab ? null : tab;
  }

  private chip(tab: ImportPlanDetailTab, label: string, count: string, warn = false): ReactNode {
    const open = this.tab === tab;
    return (
      <button
        type="button"
        className={`fc-import-detail__chip${warn ? ' fc-import-detail__chip--warn' : ''}${open ? ' fc-import-detail__chip--open' : ''}`}
        onClick={() => this.select(tab)}
        aria-expanded={open}
      >
        {label}
        <span className="fc-import-detail__chip-count">{count}</span>
        <span className="fc-import-detail__chip-caret" aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
    );
  }

  /**
   * Written into the archive at EXPORT time — what it holds, not what THIS import decides. Kept
   * verbatim and kept apart, because a note the archive wrote about itself is not a decision this
   * screen made, and reading them as one list is how an operator ends up chasing a non-problem.
   */
  private static notes(rule: string, list: string[], mark: string, markClass: string): ReactNode {
    return (
      <div className="fc-import-detail__panel">
        <p className="fc-import-detail__rule">{rule}</p>
        <ul className="fc-import-detail__notes">
          {list.map((note) => (
            <li key={note}>
              <span className={`fc-import-detail__note-mark ${markClass}`} aria-hidden="true">{mark}</span>
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  private renderPanel(): ReactNode {
    const tab = this.tab;
    if (tab === ImportPlanDetailTab.RECORDS) {
      return <div className="fc-import-detail__panel"><ImportPlanRecords records={this.records} /></div>;
    }
    if (tab === ImportPlanDetailTab.EXTENSIONS) {
      return (
        <div className="fc-import-detail__panel">
          <ImportPlanInventory plugins={this.plugins} theme={this.theme} records={this.records} />
        </div>
      );
    }
    if (tab === ImportPlanDetailTab.WARNINGS) {
      return ImportPlanDetail.notes(
        'Things this import noticed while planning. None of them stops it — anything that would is shown at the top of this card as a blocker.',
        this.warnings, '!', 'fc-import-detail__note-mark--warn',
      );
    }
    if (tab === ImportPlanDetailTab.EXPORT) {
      return ImportPlanDetail.notes(
        'Written into the archive when it was exported. They describe what the archive holds, not what this import decides; everything this import will do is stated above.',
        this.exportWarnings, 'i', 'fc-import-detail__note-mark--info',
      );
    }
    return null;
  }

  render(): ReactNode {
    const kinds = this.records.length;
    const extensions = `${this.plugins.length}${this.theme ? ' + 1' : ''}`;
    return (
      <div className="fc-import-detail">
        <div className="fc-import-detail__head">
          <h4 className="fc-import-detail__title">Full detail</h4>
          <span className="fc-import-detail__hint">nothing is hidden — open any of these</span>
        </div>
        <div className="fc-import-detail__chips">
          {this.chip(ImportPlanDetailTab.RECORDS, 'Everything in the archive', kinds.toLocaleString())}
          {this.chip(ImportPlanDetailTab.EXTENSIONS, 'Plugins & theme', extensions)}
          {this.warnings.length ? this.chip(ImportPlanDetailTab.WARNINGS, 'Warnings', this.warnings.length.toLocaleString(), true) : null}
          {this.exportWarnings.length ? this.chip(ImportPlanDetailTab.EXPORT, 'Notes from the export', this.exportWarnings.length.toLocaleString()) : null}
        </div>
        {this.renderPanel()}
      </div>
    );
  }
}
