import type { ReactNode } from 'react';
import type { IImportPlanTable } from '@/app/sites/import/interfaces/import-plan-table.interface';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { SystemConstants } from '@fromcode119/core/client';

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
  /**
   * The plan's own excluded-row totals, passed straight through from `ImportPlanArrivals`'/
   * `ImportPlanSummary`'s source (`plan.metaRowsExcluded`/`plan.pluginSettingsRowsExcluded`) rather
   * than re-derived here. Only the row whose physical name IS `_system_meta`/`_system_plugin_settings`
   * ever has a nonzero figure to show — the executor's own rowFilter (`TenantBespokePolicies` /
   * `TenantInstalledPluginSlugs`) never excludes rows from any other table.
   */
  @prop declare metaRowsExcluded: number;
  @prop declare pluginSettingsRowsExcluded: number;

  /** The count and reason for THIS row's own excluded rows, when it is one of the two tables that has any. */
  private get excludedRows(): { count: number; reason: string } | null {
    const name = this.table.name;
    if (name === SystemConstants.TABLE.META && this.metaRowsExcluded > 0) {
      return { count: this.metaRowsExcluded, reason: 'belong to a deployment, not this site' };
    }
    if (name === SystemConstants.TABLE.PLUGIN_SETTINGS && this.pluginSettingsRowsExcluded > 0) {
      return { count: this.pluginSettingsRowsExcluded, reason: 'are for a plugin not installed here' };
    }
    return null;
  }

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
    const excluded = this.excludedRows;
    if (!dropped && !opaque && !excluded) return this.kind === 'skipped' ? null : <span className="fc-import-plan__chip fc-import-plan__chip--ok">nothing lost</span>;
    const parts: string[] = [];
    if (dropped > 0) parts.push(`${dropped.toLocaleString()} field${dropped === 1 ? '' : 's'} not carried over`);
    if (opaque > 0) parts.push(`${opaque.toLocaleString()} linked id${opaque === 1 ? '' : 's'} not updated`);
    if (excluded) parts.push(`${excluded.count.toLocaleString()} row${excluded.count === 1 ? '' : 's'} not carried over`);
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

  /** The three PRESERVE bases the planner actually emits (`TenantImportPlanner.decideIds`) — never guessed. */
  private static keptReason(basis: IImportPlanTable['basis']): string {
    if (basis === 'naturalKey') return 'the table has no serial id; rows are keyed naturally';
    if (basis === 'empty') return 'this table has no rows with a numeric id to compare';
    return 'every id in the archive is already above what this platform has handed out';
  }

  private renderDetail(): ReactNode {
    const table = this.table;
    const rows: ReactNode[] = [];
    if (this.kind === 'remapped') {
      rows.push(<div key="minId"><dt>Lowest id in the archive</dt><dd>{table.minId?.toLocaleString()}</dd></div>);
      rows.push(<div key="taken"><dt>Already handed out here</dt><dd>{table.taken?.toLocaleString()}</dd></div>);
    } else if (this.kind === 'kept') {
      rows.push(<div key="why"><dt>Why the id was kept</dt><dd>{ImportPlanTableRow.keptReason(table.basis)}</dd></div>);
      if (table.taken !== null) rows.push(<div key="taken"><dt>Already handed out here</dt><dd>{table.taken.toLocaleString()}</dd></div>);
    }
    const excluded = this.excludedRows;
    if (excluded) {
      rows.push(<div key="excluded"><dt>Rows not carried over</dt><dd>{excluded.count.toLocaleString()} row(s) {excluded.reason}</dd></div>);
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
