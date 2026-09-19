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
  /** A record of what happened — counted, but never named first. */
  isJournal: boolean;
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

  /**
   * The kinds worth NAMING: those a plugin owns and has given a name of its own.
   *
   * Two conditions, both read from the plan, neither naming anything. A kind with no label has no
   * word a reader would recognise. A kind with no owning plugin is the framework's own plumbing —
   * `_system_meta` carries the label "Global Settings" and would otherwise lead the list ahead of a
   * shop's orders, which is machinery presented as if it were the shop's. Whatever a plugin calls
   * its records is what appears here, so a plugin written tomorrow needs no change to this file.
   */
  private get labeled(): IImportPlanTable[] {
    return this.arriving.filter((table) => Boolean(table.label) && Boolean(table.pluginSlug));
  }

  /** Everything else: unlabelled, or the framework's own. Counted in every total, folded for detail. */
  private get platformRecords(): IImportPlanTable[] {
    return this.arriving.filter((table) => !(table.label && table.pluginSlug));
  }

  /** `table.rows`, net of the executor's own exclusion for the one table (if any) this is. */
  private netRows(table: IImportPlanTable): number {
    if (table.name === SystemConstants.TABLE.META) return table.rows - this.metaRowsExcluded;
    if (table.name === SystemConstants.TABLE.PLUGIN_SETTINGS) return table.rows - this.pluginSettingsRowsExcluded;
    return table.rows;
  }

  /** Every labelled table plus the two counts that are not table rows at all — people and files. */
  private get items(): IArrivalItem[] {
    const items: IArrivalItem[] = this.labeled.map((table) => ({ key: table.name, count: this.netRows(table), label: table.label as string, isJournal: !!table.isJournal }));
    if (this.users.total > 0) items.push({ key: '__people', count: this.users.total, label: 'people', isJournal: false });
    if (this.files.count > 0) items.push({ key: '__files', count: this.files.count, label: 'files', isJournal: false });
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
        <summary>{this.platformRecordsTotal.toLocaleString()} more the platform keeps for you &mdash; see what</summary>
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

  /**
   * The few kinds worth naming, and a count for the rest.
   *
   * Every kind on one line was fifty items joined by a separator — unreadable, and it buried the six
   * an operator recognises among forty-four they do not. The cut is by SIZE, which the plan already
   * decided; a hand-picked order would be the hardcoded extension list Rule Zero forbids.
   */
  private static readonly NAMED = 6;

  render(): ReactNode {
    const allItems = this.items;
    // A journal is a record of what happened — events, consents, sessions. It outnumbers everything
    // a shop actually has, so naming the biggest kinds would name nothing but telemetry and bury the
    // handful the reader recognises. It still counts in the total and still shows in full detail;
    // it just is not named first. Which kinds those are is DECLARED by the collection that owns
    // them, never guessed from a name or a row count.
    const named = allItems.filter((item) => !item.isJournal);
    const items = named.slice(0, ImportPlanArrivals.NAMED);
    const otherKinds = allItems.length - items.length;
    const platformRecords = this.platformRecords;

    return (
      <div className="fc-import-plan__arrivals">
        <span className="fc-site-form__label">Everything comes across</span>
        {items.length === 0 && platformRecords.length === 0 ? <span className="fc-sites__none">nothing</span> : null}
        {items.length > 0 ? (
          <div className="fc-import-plan__tiles">
            {items.map((item) => (
              <div key={item.key} className="fc-import-plan__tile">
                <span className="fc-import-plan__tile-count">{item.count.toLocaleString()}</span>
                <span className="fc-import-plan__tile-label">{item.label}</span>
              </div>
            ))}
          </div>
        ) : null}
        {platformRecords.length > 0 ? this.renderPlatformRecordsDetail() : null}
        {otherKinds > 0 ? (
          <p className="fc-import-plan__arrival-total">…and {otherKinds.toLocaleString()} other kind(s) of record — {this.totalRows.toLocaleString()} in total.</p>
        ) : this.arriving.length > 0 ? (
          <p className="fc-import-plan__arrival-total">{this.totalRows.toLocaleString()} in total.</p>
        ) : null}
      </div>
    );
  }
}
