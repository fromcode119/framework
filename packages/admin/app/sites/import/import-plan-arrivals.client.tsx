import type { ReactNode } from 'react';
import type { IArrivalItem } from '@/app/sites/import/interfaces/arrival-item.interface';
import { Reactor, bound, prop, state } from '@fromcode119/react-class-components';
import { ImportPlanRecord } from '@/app/sites/import/import-plan-record';
import { ImportPlanGrouping } from '@/app/sites/import/import-plan-groups';

/**
 * "What arrives", as things an operator recognizes — not as rows in a schema.
 *
 * The old page led with a 54-row table of physical table names, id sequences and JSON column lists.
 * That is a database engineer's view of the same import; a shop owner presses the button to find out
 * what they get. This answers that question first: a handful of counted, human-labelled things,
 * ordered by how much of the archive they are — not by a hand-maintained list of collection or
 * plugin names, which would bake specific extensions into the framework.
 *
 * A kind with no human label (an audit log, a record-version snapshot, a raw settings row) is real
 * and still arrives, so its count is never dropped — it is folded into one "platform records" figure
 * instead of naming each physical table beside orders and pages. That fold is a TILE rather than a
 * line of prose under the row, because it is one more count in the same list and reads as one.
 */
export class ImportPlanArrivals extends Reactor {
  /** Every kind in the archive, for the platform-records fold to name what it folded. */
  @prop declare records: ImportPlanRecord[];
  /** Those with rows and somewhere to put them. */
  @prop declare arriving: ImportPlanRecord[];
  @prop declare users: { total: number; existing: number; toCreate: number };
  @prop declare files: { count: number; colliding: number };
  @state private showPlatform = false;

  @bound private togglePlatform(): void {
    this.showPlatform = !this.showPlatform;
  }

  /**
   * The kinds worth NAMING: those a plugin owns and has given a name of its own.
   *
   * Two conditions, both read from the plan, neither naming anything. A kind with no label has no
   * word a reader would recognise. A kind with no owning plugin is the framework's own plumbing —
   * `_system_meta` carries the label "Global Settings" and would otherwise lead the list ahead of a
   * shop's orders, which is machinery presented as if it were the shop's.
   */
  private get labeled(): ImportPlanRecord[] {
    return this.arriving.filter((record) => Boolean(record.table.label) && Boolean(record.table.pluginSlug));
  }

  private get platformRecords(): ImportPlanRecord[] {
    return this.arriving.filter((record) => !(record.table.label && record.table.pluginSlug));
  }

  /** Every labelled kind plus the two counts that are not table rows at all — people and files. */
  private get items(): IArrivalItem[] {
    const items: IArrivalItem[] = this.labeled.map((record) => ({
      key: record.table.name, count: record.arrivingRows, label: record.table.label as string, isJournal: record.table.isJournal,
    }));
    if (this.users.total > 0) items.push({ key: '__people', count: this.users.total, label: 'People', isJournal: false });
    if (this.files.count > 0) items.push({ key: '__files', count: this.files.count, label: 'Files', isJournal: false });
    // Biggest first — the thing an operator should not have to scroll to find is the one most of the
    // archive actually is. A hand-picked order would be exactly the hardcoded extension list Rule
    // Zero forbids; this is derived from the counts the plan already produced.
    return items.sort((a, b) => b.count - a.count);
  }

  private get platformTotal(): number {
    return this.platformRecords.reduce((sum, record) => sum + record.arrivingRows, 0);
  }

  private get totalRows(): number {
    return this.arriving.reduce((sum, record) => sum + record.arrivingRows, 0);
  }

  /**
   * The few kinds worth naming, and a tile for the rest.
   *
   * Every kind on one line was fifty items joined by a separator — unreadable, and it buried the six
   * an operator recognises among forty-four they do not. The cut is by SIZE, which the plan already
   * decided; a hand-picked order would be the hardcoded extension list Rule Zero forbids.
   */
  private static readonly NAMED = 6;

  private renderPlatformDetail(): ReactNode {
    const groups = ImportPlanGrouping.byPlugin(this.platformRecords.map((record) => record.table));
    const rows = new Map(this.platformRecords.map((record) => [record.table.name, record.arrivingRows]));
    return (
      <div className="fc-import-plan__platform-detail">
        {groups.map((group) => (
          <p key={group.key} className="fc-import-rec__foldline">
            <strong>{group.key}</strong> — {group.tables.map((table) => `${table.label ?? table.name} (${(rows.get(table.name) ?? 0).toLocaleString()})`).join(', ')}
          </p>
        ))}
      </div>
    );
  }

  render(): ReactNode {
    const allItems = this.items;
    // A journal is a record of what happened — events, consents, sessions. It outnumbers everything
    // a shop actually has, so naming the biggest kinds would name nothing but telemetry and bury the
    // handful the reader recognises. It still counts in the total and still shows in full detail;
    // it just is not named first. Which kinds those are is DECLARED by the collection that owns
    // them, never guessed from a name or a row count.
    const named = allItems.filter((item) => !item.isJournal);
    const items = named.slice(0, ImportPlanArrivals.NAMED);
    const platformRecords = this.platformRecords;
    const platformTotal = this.platformTotal;

    return (
      <div className="fc-import-plan__arrivals">
        <div className="fc-import-plan__arrivals-head">
          <span className="fc-site-form__label">You get</span>
          {this.arriving.length ? <span className="fc-import-plan__arrivals-total">{this.totalRows.toLocaleString()} records in total</span> : null}
        </div>
        {items.length === 0 && platformRecords.length === 0 ? <span className="fc-sites__none">nothing</span> : null}
        <div className="fc-import-plan__tiles">
          {items.map((item) => (
            <div key={item.key} className="fc-import-plan__tile">
              <span className="fc-import-plan__tile-count">{item.count.toLocaleString()}</span>
              <span className="fc-import-plan__tile-label">{item.label}</span>
            </div>
          ))}
          {platformRecords.length ? (
            <button
              type="button"
              className="fc-import-plan__tile fc-import-plan__tile--rest"
              onClick={this.togglePlatform}
              aria-expanded={this.showPlatform}
            >
              <span className="fc-import-plan__tile-count">+{platformTotal.toLocaleString()}</span>
              <span className="fc-import-plan__tile-label">
                {this.showPlatform ? 'hide the list' : `platform records · ${platformRecords.length.toLocaleString()} kind(s)`}
              </span>
            </button>
          ) : null}
        </div>
        {this.showPlatform ? this.renderPlatformDetail() : null}
      </div>
    );
  }
}
