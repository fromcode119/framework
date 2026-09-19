import type { ReactNode } from 'react';
import type { IImportPlanTable } from '@/app/sites/import/interfaces/import-plan-table.interface';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { ImportPlanTableRow } from '@/app/sites/import/import-plan-table-row.client';
import { ImportPlanGrouping } from '@/app/sites/import/import-plan-groups';
import { ImportPlanRowKind } from '@/app/sites/import/enums/import-plan-row-kind.enum';

/**
 * The four groups an operator can check every table against: not imported, re-numbered, ids kept,
 * empty. This is the database-engineer view that used to headline the page — a 54-row table with
 * `LOWEST ID` / `HANDED OUT HERE` as first-class columns and a per-row dump of every dropped column.
 * It still exists (Rule Zero: nothing that has an effect may be hidden), but it is no longer the
 * FIRST thing the operator reads — `ImportPlanArrivals`/`ImportPlanSummary` answer "what do I get,
 * what do I lose" above this; each row here answers "prove it" for one specific table, collapsed by
 * default (`ImportPlanTableRow`), so the mechanics are one click away rather than the opening view.
 *
 * The rule behind each mode is generic — it comes from a literal in the planner — so it is stated
 * ONCE, as the group's heading, not repeated per row.
 */
export class ImportPlanTables extends PureReactor {
  @prop declare skipped: IImportPlanTable[];
  @prop declare remapped: IImportPlanTable[];
  @prop declare kept: IImportPlanTable[];
  @prop declare empty: IImportPlanTable[];
  /** Passed straight through to every row, so the one table that has any (`_system_meta` or `_system_plugin_settings`) can say so. */
  @prop declare metaRowsExcluded: number;
  @prop declare pluginSettingsRowsExcluded: number;

  private static group(title: string, count: number, rule: string, body: ReactNode): ReactNode {
    return (
      <section className="fc-import-plan__group">
        <span className="fc-site-form__label">
          {title} <span className="fc-import-plan__count">{count}</span>
        </span>
        <p className="fc-import-plan__rule">{rule}</p>
        {count === 0 ? <span className="fc-sites__none">none</span> : body}
      </section>
    );
  }

  /** The empty group's table names, grouped by owning plugin (`platform` for a framework table or an unmatched one). */
  private static emptyByPlugin(tables: IImportPlanTable[]): ReactNode {
    const groups = ImportPlanGrouping.byPlugin(tables);
    return (
      <span className="fc-import-plan__cols">
        {groups.map((group, groupIndex) => (
          <span key={group.key}>
            <strong>{group.key}</strong> — {group.tables.map((table, i) => (
              <span key={table.name}>
                {table.label ? table.label : <code>{table.name}</code>}
                {i < group.tables.length - 1 ? ', ' : ''}
              </span>
            ))}
            {groupIndex < groups.length - 1 ? ' · ' : ''}
          </span>
        ))}
      </span>
    );
  }

  render(): ReactNode {
    const { skipped, remapped, kept, empty, metaRowsExcluded, pluginSettingsRowsExcluded } = this;
    const skippedRows = skipped.reduce((sum, t) => sum + t.rows, 0);

    return (
      <div className="fc-import-plan__tables">
        {ImportPlanTables.group(
          'Not imported', skipped.length,
          `The plugin that owns each of these is not installed or not enabled here, so there is nowhere to put the rows — ${skippedRows.toLocaleString()} row(s) in total. Install and enable it, then import again, to keep them.`,
          <div className="fc-import-plan__rows">
            {skipped.map((table) => (
              <ImportPlanTableRow
                key={table.name} table={table} kind={ImportPlanRowKind.SKIPPED}
                metaRowsExcluded={metaRowsExcluded} pluginSettingsRowsExcluded={pluginSettingsRowsExcluded}
              />
            ))}
          </div>,
        )}

        {ImportPlanTables.group(
          'Re-numbered', remapped.length,
          'The archive’s lowest id is at or below the highest id this platform has already handed out for that table, so its rows get new ids and every reference to them is re-pointed. Expand a row for the exact ids and columns.',
          <div className="fc-import-plan__rows">
            {remapped.map((table) => (
              <ImportPlanTableRow
                key={table.name} table={table} kind={ImportPlanRowKind.REMAPPED}
                metaRowsExcluded={metaRowsExcluded} pluginSettingsRowsExcluded={pluginSettingsRowsExcluded}
              />
            ))}
          </div>,
        )}

        {ImportPlanTables.group(
          'Ids kept', kept.length,
          'Either the table has no serial id and its rows are keyed naturally, every id in the archive is already above the highest this platform has handed out, or none of its rows carry a numeric id to compare in the first place — in each case there is nothing to re-number.',
          <div className="fc-import-plan__rows">
            {kept.map((table) => (
              <ImportPlanTableRow
                key={table.name} table={table} kind={ImportPlanRowKind.KEPT}
                metaRowsExcluded={metaRowsExcluded} pluginSettingsRowsExcluded={pluginSettingsRowsExcluded}
              />
            ))}
          </div>,
        )}

        {ImportPlanTables.group(
          'Empty', empty.length,
          `${empty.length.toLocaleString()} table(s) in the archive carry no rows, so nothing is written, lost or re-numbered for them.`,
          <details className="fc-import-plan__empty" open>
            <summary>Which tables</summary>
            {ImportPlanTables.emptyByPlugin(empty)}
          </details>,
        )}
      </div>
    );
  }
}
