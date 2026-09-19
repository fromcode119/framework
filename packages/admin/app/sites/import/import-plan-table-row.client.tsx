import type { ReactNode } from 'react';
import type { IImportPlanTable } from '@/app/sites/import/interfaces/import-plan-table.interface';
import { PureReactor, prop } from '@fromcode119/react-class-components';

/**
 * One table, in one of the three non-empty groups. The row itself says only what an operator needs
 * to check this table off: its name, its row count, and — in plain terms — whether anything about it
 * is lost. Everything else this platform can prove about the table (the id it started from, how many
 * ids this platform had already handed out, which columns get re-pointed or dropped) is real and
 * stays reachable, but behind this row's own `<details>` rather than in the row itself: that is what
 * used to make one row of `RE-NUMBERED` a wall of `LOWEST ID` / `HANDED OUT HERE` / column names.
 *
 * `skipped` rows have no mechanics to disclose — `basis`/`minId`/`taken` are all null for a SKIP-mode
 * table (the planner never computes them) — so they render as a plain line, no empty triangle
 * pretending there is more to see.
 */
export class ImportPlanTableRow extends PureReactor {
  @prop declare table: IImportPlanTable;
  /** Which group the row belongs to — decides what mechanics (if any) its disclosure can show. */
  @prop declare kind: 'skipped' | 'remapped' | 'kept';

  /** One `<code>` per name so the line wraps BETWEEN names instead of clipping through one. */
  private static columns(label: string, names: string[]): ReactNode {
    if (!names.length) return null;
    return (
      <span className="fc-import-plan__cols">
        <span className="fc-import-plan__cols-label">{label}</span>
        {names.map((name) => <code key={name}>{name}</code>)}
      </span>
    );
  }

  /** The row's own name: its human label, followed by the physical table name muted in `<code>`. */
  private get rowLabel(): ReactNode {
    const table = this.table;
    if (!table.label) return <code>{table.name}</code>;
    return <>{table.label} <code className="fc-import-plan__table-physical">{table.name}</code></>;
  }

  /** What is NOT carried over, said as a count first — the thing a row summary can show at a glance. */
  private get lossChip(): ReactNode {
    const table = this.table;
    const dropped = table.droppedColumns.length;
    const opaque = table.opaqueJsonColumns.length;
    if (!dropped && !opaque) return this.kind === 'skipped' ? null : <span className="fc-import-plan__chip fc-import-plan__chip--ok">nothing lost</span>;
    const parts: string[] = [];
    if (dropped > 0) parts.push(`${dropped.toLocaleString()} field${dropped === 1 ? '' : 's'} not carried over`);
    if (opaque > 0) parts.push(`${opaque.toLocaleString()} linked id${opaque === 1 ? '' : 's'} not updated`);
    return <span className="fc-import-plan__chip">{parts.join(', ')}</span>;
  }

  /** The positive counterpart of the lost columns: what the remap WILL follow. */
  private get repointed(): ReactNode {
    const labels = this.table.repointedReferences.map((ref) => `${ref.path.length ? `${ref.column}[].${ref.path.join('.')}` : ref.column} → ${ref.targetTable}`);
    return ImportPlanTableRow.columns('Re-pointed to', labels);
  }

  private get lost(): ReactNode {
    const table = this.table;
    const json = ImportPlanTableRow.columns('Linked ids not updated (JSON)', table.opaqueJsonColumns);
    const dropped = ImportPlanTableRow.columns('Not carried over', table.droppedColumns);
    if (!json && !dropped) return null;
    return <>{json}{dropped}</>;
  }

  private renderDetail(): ReactNode {
    const table = this.table;
    const rows: ReactNode[] = [];
    if (this.kind === 'remapped') {
      rows.push(<div key="minId"><dt>Lowest id in the archive</dt><dd>{table.minId?.toLocaleString()}</dd></div>);
      rows.push(<div key="taken"><dt>Already handed out here</dt><dd>{table.taken?.toLocaleString()}</dd></div>);
    } else if (this.kind === 'kept') {
      rows.push(<div key="why"><dt>Why the id was kept</dt><dd>{table.basis === 'naturalKey' ? 'the table has no serial id; rows are keyed naturally' : 'every id in the archive is already above what this platform has handed out'}</dd></div>);
      if (table.taken !== null) rows.push(<div key="taken"><dt>Already handed out here</dt><dd>{table.taken.toLocaleString()}</dd></div>);
    }
    const repointed = this.kind === 'remapped' ? this.repointed : null;
    const lost = this.lost;
    if (!rows.length && !repointed && !lost) return null;
    return (
      <details className="fc-import-plan__row-detail">
        <summary>Details</summary>
        <dl className="fc-import-plan__row-mechanics">{rows}</dl>
        {repointed}
        {lost}
      </details>
    );
  }

  render(): ReactNode {
    const table = this.table;
    const detail = this.kind === 'skipped' ? null : this.renderDetail();

    return (
      <div className="fc-import-plan__row">
        <div className="fc-import-plan__row-summary">
          <span className="fc-import-plan__row-label">{this.rowLabel}</span>
          <span className="fc-import-plan__row-rows">{table.rows.toLocaleString()} row(s)</span>
          {this.kind === 'skipped' ? null : this.lossChip}
        </div>
        {detail}
      </div>
    );
  }
}
