import type { ReactNode } from 'react';
import type { IImportPlanTable } from '@/app/sites/import/interfaces/import-plan-table.interface';
import { PureReactor, prop } from '@fromcode119/react-class-components';

/**
 * "What happens" — the three questions an operator has before deciding, answered from data
 * `ImportPlanTables` already carries. Never a second source of truth for a number those groups
 * also show; this only adds up what is already there, and never restates the header paragraph's
 * own people/file counts (see `ImportPlanView`) — each number appears exactly once.
 */
export class ImportPlanSummary extends PureReactor {
  @prop declare plan: Record<string, any>;
  /** Rows with somewhere to go: `rows > 0` and NOT skipped. */
  @prop declare arriving: IImportPlanTable[];
  /** Rows with nowhere to go: `rows > 0` and skipped (the plugin that owns them is not installed/enabled). */
  @prop declare skipped: IImportPlanTable[];
  /** Rows whose ids get re-numbered. */
  @prop declare remapped: IImportPlanTable[];

  render(): ReactNode {
    const { plan, arriving, skipped, remapped } = this;
    const rowsArriving = arriving.reduce((sum, t) => sum + t.rows, 0);
    const skippedRows = skipped.reduce((sum, t) => sum + t.rows, 0);
    const arrives = `${rowsArriving.toLocaleString()} row(s) across ${arriving.length.toLocaleString()} table(s).`;

    const droppedTables = arriving.filter((t) => t.droppedColumns.length > 0);
    const droppedColumnsTotal = droppedTables.reduce((sum, t) => sum + t.droppedColumns.length, 0);
    const opaqueJsonTables = remapped.filter((t) => t.opaqueJsonColumns.length > 0);
    const opaqueJsonColumnsTotal = opaqueJsonTables.reduce((sum, t) => sum + t.opaqueJsonColumns.length, 0);
    const metaRowsExcluded: number = plan.metaRowsExcluded ?? 0;
    const pluginSettingsRowsExcluded: number = plan.pluginSettingsRowsExcluded ?? 0;

    const leftBehindParts: string[] = [];
    if (skippedRows > 0) leftBehindParts.push(`${skippedRows.toLocaleString()} row(s) across ${skipped.length.toLocaleString()} table(s) whose plugin is not installed or enabled here`);
    if (droppedTables.length > 0) leftBehindParts.push(`${droppedColumnsTotal.toLocaleString()} column(s) across ${droppedTables.length.toLocaleString()} table(s) this platform's schema does not have`);
    if (opaqueJsonTables.length > 0) leftBehindParts.push(`${opaqueJsonColumnsTotal.toLocaleString()} JSON column(s) across ${opaqueJsonTables.length.toLocaleString()} table(s) whose embedded ids will not be re-pointed`);
    if (metaRowsExcluded > 0) leftBehindParts.push(`${metaRowsExcluded.toLocaleString()} platform-level setting row(s) in "_system_meta"`);
    if (pluginSettingsRowsExcluded > 0) leftBehindParts.push(`${pluginSettingsRowsExcluded.toLocaleString()} setting row(s) in "_system_plugin_settings" for a plugin not installed here`);
    const leftBehind = leftBehindParts.length ? `${leftBehindParts.join('; ')}. See the groups below for the detail.` : 'nothing.';

    const files = plan.files;
    let filesClause = '';
    if (files.count > 0) {
      if (files.colliding === files.count) {
        filesClause = ' Every file in the archive is already here by name. If this archive was imported before, these will be a second copy of each.';
      } else if (files.colliding > 0) {
        filesClause = ` ${files.colliding.toLocaleString()} of ${files.count.toLocaleString()} file(s) are already here by name and will be saved alongside them under a suffixed name.`;
      }
    }
    const alreadyHere = `Nothing is replaced. ${remapped.length.toLocaleString()} table(s) get re-numbered ids.${filesClause}`;

    return (
      <div className="fc-import-plan__summary">
        <span className="fc-site-form__label">What happens</span>
        <p className="fc-sites__text"><strong>Arrives</strong> — {arrives}</p>
        <p className="fc-sites__text"><strong>Left behind</strong> — {leftBehind}</p>
        <p className="fc-sites__text"><strong>Already here</strong> — {alreadyHere}</p>
      </div>
    );
  }
}
