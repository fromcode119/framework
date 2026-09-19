import type { ReactNode } from 'react';
import type { IImportPlanTable } from '@/app/sites/import/interfaces/import-plan-table.interface';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { SystemConstants } from '@fromcode119/core/client';
import { ImportPlanGrouping } from '@/app/sites/import/import-plan-groups';

/** One line of the arrival list: a count and the human thing it counts. */
interface IArrivalItem {
  key: string;
  count: number;
  label: string;
}

/**
 * "What arrives", as things an operator recognizes — not as rows in a schema.
 *
 * The old page led with a 54-row table of physical table names, id sequences and JSON column lists.
 * That is a database engineer's view of the same import; a shop owner presses the button to find out
 * what they get. This answers that question first: a handful of counted, human-labelled things,
 * ordered by how much of the archive they are — not by a hand-maintained list of collection or
 * plugin names, which would bake specific extensions into the framework.
 *
 * A table with no human label (an audit log, a record-version snapshot, a raw settings row) is real
 * and still arrives, so its count is never dropped — it is folded into one "platform records" figure
 * instead of naming each physical table beside orders and pages, and the fold opens to the exact
 * list on request (Rule Zero: reachable, never hidden).
 */
export class ImportPlanArrivals extends PureReactor {
  /** Rows with somewhere to go: `rows > 0` and not skipped. */
  @prop declare arriving: IImportPlanTable[];
  @prop declare users: { total: number; existing: number; toCreate: number };
  @prop declare files: { count: number; colliding: number };
  /**
   * A non-skipped table's own `rows` still counts the platform-key / uninstalled-plugin-settings
   * rows the executor's rowFilter drops at import time (`_system_meta`, `_system_plugin_settings`).
   * Those are counted separately under "Won't come across", so the grand total below must not count
   * them twice — and neither may any per-table figure ABOVE the total: `_system_meta`/
   * `_system_plugin_settings` are always unlabelled (no collection targets a framework table), so
   * they always fall into `platformRecords` below, and that fold's own total must net them out the
   * same way the grand total does, or the two figures on this screen would not add up.
   */
  @prop declare metaRowsExcluded: number;
  @prop declare pluginSettingsRowsExcluded: number;

  private get labeled(): IImportPlanTable[] {
    return this.arriving.filter((table) => Boolean(table.label));
  }

  private get platformRecords(): IImportPlanTable[] {
    return this.arriving.filter((table) => !table.label);
  }

  /** `table.rows`, net of the executor's own exclusion for the one table (if any) this is. */
  private netRows(table: IImportPlanTable): number {
    if (table.name === SystemConstants.TABLE.META) return table.rows - this.metaRowsExcluded;
    if (table.name === SystemConstants.TABLE.PLUGIN_SETTINGS) return table.rows - this.pluginSettingsRowsExcluded;
    return table.rows;
  }

  /** Every labelled table plus the two counts that are not table rows at all — people and files. */
  private get items(): IArrivalItem[] {
    const items: IArrivalItem[] = this.labeled.map((table) => ({ key: table.name, count: this.netRows(table), label: table.label as string }));
    if (this.users.total > 0) items.push({ key: '__people', count: this.users.total, label: 'people' });
    if (this.files.count > 0) items.push({ key: '__files', count: this.files.count, label: 'files' });
    // Biggest first — the thing an operator should not have to scroll to find is the one most of the
    // archive actually is. A hand-picked order would be exactly the hardcoded extension list Rule
    // Zero forbids; this is derived from the counts the plan already produced.
    return items.sort((a, b) => b.count - a.count);
  }

  /** Net of exclusions, same as every other figure under "Arrives" — see the field comment above. */
  private get platformRecordsTotal(): number {
    return this.platformRecords.reduce((sum, table) => sum + this.netRows(table), 0);
  }

  /** The net row total across every arriving table, minus the rows that never actually land. */
  private get totalRows(): number {
    const raw = this.arriving.reduce((sum, table) => sum + table.rows, 0);
    return raw - this.metaRowsExcluded - this.pluginSettingsRowsExcluded;
  }

  private renderPlatformRecordsDetail(): ReactNode {
    const groups = ImportPlanGrouping.byPlugin(this.platformRecords);
    return (
      <details className="fc-import-plan__platform-records">
        <summary>{this.platformRecordsTotal.toLocaleString()} platform record(s) across {this.platformRecords.length.toLocaleString()} table(s) — which tables</summary>
        <div className="fc-import-plan__cols">
          {groups.map((group, groupIndex) => (
            <span key={group.key}>
              <strong>{group.key}</strong> — {group.tables.map((table, i) => (
                <span key={table.name}>
                  <code>{table.name}</code> ({this.netRows(table).toLocaleString()})
                  {i < group.tables.length - 1 ? ', ' : ''}
                </span>
              ))}
              {groupIndex < groups.length - 1 ? ' · ' : ''}
            </span>
          ))}
        </div>
      </details>
    );
  }

  render(): ReactNode {
    const items = this.items;
    const platformRecords = this.platformRecords;

    return (
      <div className="fc-import-plan__arrivals">
        <span className="fc-site-form__label">Arrives</span>
        {items.length === 0 && platformRecords.length === 0 ? <span className="fc-sites__none">nothing</span> : null}
        {items.length > 0 ? (
          <p className="fc-import-plan__arrival-list">
            {items.flatMap((item, i): ReactNode[] => {
              const nodes: ReactNode[] = [
                <span key={item.key} className="fc-import-plan__arrival-item">
                  <strong>{item.count.toLocaleString()}</strong> {item.label}
                </span>,
              ];
              // Its own flex item, not trailing text inside one — flex strips a collapsible space at a
              // line-box edge, which is exactly what swallowed this separator's leading space when it
              // used to live as `' · '` inside the item's own `<span>`.
              if (i < items.length - 1) {
                nodes.push(<span key={`${item.key}-sep`} className="fc-import-plan__arrival-sep" aria-hidden="true">&middot;</span>);
              }
              return nodes;
            })}
          </p>
        ) : null}
        {platformRecords.length > 0 ? this.renderPlatformRecordsDetail() : null}
        {this.arriving.length > 0 ? (
          <p className="fc-import-plan__arrival-total">{this.totalRows.toLocaleString()} row(s) across {this.arriving.length.toLocaleString()} table(s) in total.</p>
        ) : null}
      </div>
    );
  }
}
