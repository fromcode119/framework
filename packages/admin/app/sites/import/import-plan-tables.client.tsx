import type { ReactNode } from 'react';
import type { IImportPlanTable } from '@/app/sites/import/interfaces/import-plan-table.interface';
import { PureReactor, prop } from '@fromcode119/react-class-components';

/**
 * The four groups an operator reads to decide: not imported, re-numbered, ids kept, empty.
 *
 * Split out of `ImportPlanView` (which classifies the plan's tables into these groups and passes
 * them down) purely to keep each file under the size limit — the grouping rule and the row-level
 * rendering are one concern, just too much of it for one file alongside the summary and inventory.
 */
export class ImportPlanTables extends PureReactor {
  @prop declare skipped: IImportPlanTable[];
  @prop declare remapped: IImportPlanTable[];
  @prop declare kept: IImportPlanTable[];
  @prop declare empty: IImportPlanTable[];

  /** One `<code>` per name so the row wraps BETWEEN names instead of clipping through one. */
  private static columns(label: string, names: string[]): ReactNode {
    if (!names.length) return null;
    return (
      <span className="fc-import-plan__cols">
        <span className="fc-import-plan__cols-label">{label}</span>
        {names.map((name) => <code key={name}>{name}</code>)}
      </span>
    );
  }

  /** The row's first cell: its human label, followed by the physical table name muted in `<code>`. */
  private static rowLabel(table: IImportPlanTable): ReactNode {
    if (!table.label) return <code>{table.name}</code>;
    return <>{table.label} <code className="fc-import-plan__table-physical">{table.name}</code></>;
  }

  private static lost(table: IImportPlanTable): ReactNode {
    const json = ImportPlanTables.columns('JSON not re-pointed', table.opaqueJsonColumns);
    const dropped = ImportPlanTables.columns('Dropped', table.droppedColumns);
    if (!json && !dropped) return null;
    return <>{json}{dropped}</>;
  }

  /** The positive counterpart of `lost`'s "JSON not re-pointed": what the remap WILL follow. */
  private static repointed(table: IImportPlanTable): ReactNode {
    const labels = table.repointedReferences.map((ref) => `${ref.path.length ? `${ref.column}[].${ref.path.join('.')}` : ref.column} → ${ref.targetTable}`);
    return ImportPlanTables.columns('Re-pointed', labels);
  }

  /** The empty group's table names, grouped by owning plugin (`platform` for a framework table or an unmatched one). */
  private static emptyByPlugin(tables: IImportPlanTable[]): ReactNode {
    const order: string[] = [];
    const groups = new Map<string, IImportPlanTable[]>();
    for (const table of tables) {
      const key = table.pluginSlug ?? 'platform';
      if (!groups.has(key)) {
        groups.set(key, []);
        order.push(key);
      }
      groups.get(key)!.push(table);
    }
    order.sort((a, b) => {
      if (a === 'platform') return b === 'platform' ? 0 : 1;
      if (b === 'platform') return -1;
      return a.localeCompare(b);
    });
    return (
      <span className="fc-import-plan__cols">
        {order.map((key, groupIndex) => (
          <span key={key}>
            <strong>{key}</strong> — {groups.get(key)!.map((table, i) => (
              <span key={table.name}>
                {table.label ? table.label : <code>{table.name}</code>}
                {i < groups.get(key)!.length - 1 ? ', ' : ''}
              </span>
            ))}
            {groupIndex < order.length - 1 ? ' · ' : ''}
          </span>
        ))}
      </span>
    );
  }

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

  render(): ReactNode {
    const { skipped, remapped, kept, empty } = this;
    const skippedRows = skipped.reduce((sum, t) => sum + t.rows, 0);

    return (
      <div className="fc-import-plan__tables">
        {ImportPlanTables.group(
          'Not imported', skipped.length,
          `The plugin that owns each of these is not installed or not enabled here, so there is nowhere to put the rows — ${skippedRows.toLocaleString()} row(s) in total. Install and enable it, then import again, to keep them.`,
          <table className="fc-import-plan__table">
            <thead><tr><th>Table</th><th className="fc-import-plan__num">Rows</th></tr></thead>
            <tbody>
              {skipped.map((table) => (
                <tr key={table.name}>
                  <td data-label="Table">{ImportPlanTables.rowLabel(table)}</td>
                  <td data-label="Rows" className="fc-import-plan__num">{table.rows.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>,
        )}

        {ImportPlanTables.group(
          'Re-numbered', remapped.length,
          'The archive’s lowest id is at or below the highest id this platform has already handed out for that table, so its rows get new ids and every reference to them is re-pointed.',
          <table className="fc-import-plan__table">
            <thead><tr><th>Table</th><th className="fc-import-plan__num">Rows</th><th className="fc-import-plan__num">Lowest id</th><th className="fc-import-plan__num">Handed out here</th><th>Re-pointed</th><th>Not carried over</th></tr></thead>
            <tbody>
              {remapped.map((table) => (
                <tr key={table.name}>
                  <td data-label="Table">{ImportPlanTables.rowLabel(table)}</td>
                  <td data-label="Rows" className="fc-import-plan__num">{table.rows.toLocaleString()}</td>
                  <td data-label="Lowest id" className="fc-import-plan__num">{table.minId?.toLocaleString()}</td>
                  <td data-label="Handed out here" className="fc-import-plan__num">{table.taken?.toLocaleString()}</td>
                  <td data-label="Re-pointed">{ImportPlanTables.repointed(table)}</td>
                  <td data-label="Not carried over">{ImportPlanTables.lost(table)}</td>
                </tr>
              ))}
            </tbody>
          </table>,
        )}

        {ImportPlanTables.group(
          'Ids kept', kept.length,
          'Either the table has no serial id and its rows are keyed naturally, or every id in the archive is already above the highest this platform has handed out.',
          <table className="fc-import-plan__table">
            <thead><tr><th>Table</th><th className="fc-import-plan__num">Rows</th><th>Why</th><th className="fc-import-plan__num">Handed out here</th><th>Not carried over</th></tr></thead>
            <tbody>
              {kept.map((table) => (
                <tr key={table.name}>
                  <td data-label="Table">{ImportPlanTables.rowLabel(table)}</td>
                  <td data-label="Rows" className="fc-import-plan__num">{table.rows.toLocaleString()}</td>
                  <td data-label="Why">{table.basis === 'naturalKey' ? 'natural key' : 'all ids above'}</td>
                  <td data-label="Handed out here" className="fc-import-plan__num">{table.taken === null ? '' : table.taken.toLocaleString()}</td>
                  <td data-label="Not carried over">{ImportPlanTables.lost(table)}</td>
                </tr>
              ))}
            </tbody>
          </table>,
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
