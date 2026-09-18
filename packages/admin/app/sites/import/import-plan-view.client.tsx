import type { ReactNode } from 'react';
import type { IImportPlanTable } from '@/app/sites/import/interfaces/import-plan-table.interface';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { TenantImportIdMode } from '@fromcode119/core/client';


/**
 * The import plan, as something an operator can actually read before deciding. Presentational.
 *
 * This was one flat table over all 133 entries with a `Why` column of server-written prose. Roughly
 * forty rows carried the SAME sentence, differing only in two numbers, restating the badge already
 * on the row; a skipped table printed all 25 of its column names as prose; half the rows said "No
 * rows."; and at phone width the column clipped mid-word. So the page said everything and showed
 * nothing.
 *
 * The rule behind each mode is generic — it comes from a literal in the planner — so it is stated
 * ONCE, as the group's heading. What is left in a row is only what differs between rows: the counts,
 * the two id numbers, and the columns whose values do not survive.
 *
 * Nothing is hidden that has an effect (Rule Zero). Every table with rows keeps its own line, and
 * every dropped or un-re-pointed column is listed in full — those are the irreversible per-column
 * effects and this screen is the only place they appear. The empty group's own count is always on
 * screen, and its table names open by default rather than behind a click: an operator asking "which
 * 62?" should not have to find the disclosure triangle first, only whether to close it. Groups
 * render even when empty, so "nothing is skipped" is a visible fact rather than an absence the
 * operator has to infer.
 */
export class ImportPlanView extends PureReactor {
  @prop declare plan: Record<string, any>;

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
    const json = ImportPlanView.columns('JSON not re-pointed', table.opaqueJsonColumns);
    const dropped = ImportPlanView.columns('Dropped', table.droppedColumns);
    if (!json && !dropped) return null;
    return <>{json}{dropped}</>;
  }

  /** The positive counterpart of `lost`'s "JSON not re-pointed": what the remap WILL follow. */
  private static repointed(table: IImportPlanTable): ReactNode {
    const labels = table.repointedReferences.map((ref) => `${ref.path.length ? `${ref.column}[].${ref.path.join('.')}` : ref.column} → ${ref.targetTable}`);
    return ImportPlanView.columns('Re-pointed', labels);
  }

  /**
   * A short list reads as a list; ninety lines read as nothing.
   *
   * A real archive carries one export warning per table this platform declares that its source did
   * not have — about ninety of them — which buried the handful that say something. They are folded,
   * never dropped: the count is on screen unfolded, the text is one click away and still found by
   * find-in-page. Safe to fold because a warning has no effect of its own; every effect it describes
   * is already stated unfolded in the groups above (and blockers, which DO stop the import, are
   * rendered separately and never fold).
   */
  private static warnings(list: string[]): ReactNode {
    if (!list.length) return null;
    const items = <ul className="fc-sites__warnings">{list.map((w) => <li key={w}>{w}</li>)}</ul>;
    if (list.length <= 5) return items;
    return (
      <details className="fc-import-plan__warnings">
        <summary>{list.length} warnings</summary>
        {items}
      </details>
    );
  }

  /**
   * Written into the archive at EXPORT time — what it holds, not what THIS import decides. Always
   * folded, whatever the count: unlike the import warnings above, these carry no effect the operator
   * needs to weigh before deciding, so there is no threshold at which showing them unfolded earns its
   * place. Rendered verbatim — this screen does not parse or shorten a note it did not write.
   */
  private static exportWarnings(list: string[]): ReactNode {
    if (!list.length) return null;
    return (
      <details className="fc-import-plan__warnings">
        <summary>From the export ({list.length})</summary>
        <p className="fc-import-plan__rule">
          Written into the archive when it was exported. They describe what the archive holds, not what this import decides; everything this import will do is stated above.
        </p>
        <ul className="fc-sites__warnings">{list.map((w) => <li key={w}>{w}</li>)}</ul>
      </details>
    );
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
    const plan = this.plan;
    const all: IImportPlanTable[] = plan.tables ?? [];
    const manifest = plan.manifest ?? {};

    // A 0-row table is a no-op whatever its mode, so it groups by emptiness first. Biggest data
    // first within each group — the rows that matter most are the ones you should not have to scroll to.
    const byRows = (a: IImportPlanTable, b: IImportPlanTable) => b.rows - a.rows;
    const empty = all.filter((t) => t.rows === 0);
    const withRows = all.filter((t) => t.rows > 0);
    const skipped = withRows.filter((t) => t.mode === String(TenantImportIdMode.SKIP.value)).sort(byRows);
    const remapped = withRows.filter((t) => t.mode === String(TenantImportIdMode.REMAP.value)).sort(byRows);
    const kept = withRows.filter((t) => t.mode === String(TenantImportIdMode.PRESERVE.value)).sort(byRows);
    const skippedRows = skipped.reduce((sum, t) => sum + t.rows, 0);

    // "What happens" — the three questions an operator has before deciding, answered from data the
    // groups below already carry. Never a second source of truth for a number the groups also show;
    // this just adds up what is already there.
    const rowsArriving = withRows.reduce((sum, t) => sum + t.rows, 0);
    const files = plan.files ?? null;
    const users = plan.users ?? null;
    const arrives = `${rowsArriving.toLocaleString()} row(s) across ${withRows.length.toLocaleString()} table(s)`
      + (files ? `, ${files.count.toLocaleString()} file(s)` : '')
      + (users ? `, and ${users.total.toLocaleString()} people (${users.existing.toLocaleString()} already have an account here, ${users.toCreate.toLocaleString()} will be created)` : '')
      + '.';

    const droppedTables = withRows.filter((t) => t.droppedColumns.length > 0);
    const droppedColumnsTotal = droppedTables.reduce((sum, t) => sum + t.droppedColumns.length, 0);
    const leftBehindParts: string[] = [];
    if (skippedRows > 0) leftBehindParts.push(`${skippedRows.toLocaleString()} row(s) across ${skipped.length.toLocaleString()} table(s) whose plugin is not installed or enabled here`);
    if (droppedTables.length > 0) leftBehindParts.push(`${droppedColumnsTotal.toLocaleString()} column(s) across ${droppedTables.length.toLocaleString()} table(s) this platform's schema does not have`);
    const leftBehind = leftBehindParts.length ? `${leftBehindParts.join('; ')}. See the groups below for the detail.` : 'nothing.';

    let filesClause = '';
    if (files && files.count > 0) {
      if (files.colliding === files.count) {
        filesClause = ' Every file in the archive is already here by name. If this archive was imported before, these will be a second copy of each.';
      } else if (files.colliding > 0) {
        filesClause = ` ${files.colliding.toLocaleString()} of ${files.count.toLocaleString()} file(s) are already here by name and will be saved alongside them under a suffixed name.`;
      }
    }
    const alreadyHere = `Nothing is replaced. ${remapped.length.toLocaleString()} table(s) get re-numbered ids.${filesClause}`;

    return (
      <div className="fc-import-plan">
        <p className="fc-sites__text">
          Archive of <strong>{manifest.tenant?.slug}</strong> ({manifest.source === 'single-tenant' ? 'a single-tenant deployment' : 'a site'}), exported {manifest.exportedAt} from framework {manifest.frameworkVersion || '?'}.
          {' '}{plan.users?.total ?? 0} people: {plan.users?.existing ?? 0} already have accounts here, {plan.users?.toCreate ?? 0} will be created.
          {' '}{plan.files?.count ?? 0} files{plan.files?.colliding ? ` (${plan.files.colliding} renamed)` : ''}.
        </p>

        {(plan.blockers ?? []).length ? (
          <ul className="fc-sites__blockers">{plan.blockers.map((b: string) => <li key={b}>{b}</li>)}</ul>
        ) : null}

        <div className="fc-import-plan__summary">
          <span className="fc-site-form__label">What happens</span>
          <p className="fc-sites__text"><strong>Arrives</strong> — {arrives}</p>
          <p className="fc-sites__text"><strong>Left behind</strong> — {leftBehind}</p>
          <p className="fc-sites__text"><strong>Already here</strong> — {alreadyHere}</p>
        </div>

        <div className="fc-import-plan__inventory">
          <div>
            <span className="fc-site-form__label">Plugins</span>
            {(plan.plugins ?? []).length === 0 ? <span className="fc-sites__none">none</span> : null}
            {(plan.plugins ?? []).map((p: any) => (
              <span key={p.slug} className="fc-import-plan__item">
                {p.slug} {p.archiveVersion}{' '}
                {p.installedVersion ? <Badge variant={BadgeVariant.SUCCESS}>installed {p.installedVersion}</Badge> : <Badge variant={BadgeVariant.DANGER}>not installed</Badge>}
              </span>
            ))}
          </div>
          <div>
            <span className="fc-site-form__label">Theme</span>
            {plan.theme ? (
              <span className="fc-import-plan__item">
                {plan.theme.slug} {plan.theme.archiveVersion}{' '}
                {plan.theme.installedVersion ? <Badge variant={BadgeVariant.SUCCESS}>installed {plan.theme.installedVersion}</Badge> : <Badge variant={BadgeVariant.DANGER}>not installed</Badge>}
              </span>
            ) : <span className="fc-sites__none">none</span>}
          </div>
        </div>

        <div className="fc-import-plan__tables">
          {ImportPlanView.group(
            'Not imported', skipped.length,
            `The plugin that owns each of these is not installed or not enabled here, so there is nowhere to put the rows — ${skippedRows.toLocaleString()} row(s) in total. Install and enable it, then import again, to keep them.`,
            <table className="fc-import-plan__table">
              <thead><tr><th>Table</th><th className="fc-import-plan__num">Rows</th></tr></thead>
              <tbody>
                {skipped.map((table) => (
                  <tr key={table.name}>
                    <td data-label="Table">{ImportPlanView.rowLabel(table)}</td>
                    <td data-label="Rows" className="fc-import-plan__num">{table.rows.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>,
          )}

          {ImportPlanView.group(
            'Re-numbered', remapped.length,
            'The archive’s lowest id is at or below the highest id this platform has already handed out for that table, so its rows get new ids and every reference to them is re-pointed.',
            <table className="fc-import-plan__table">
              <thead><tr><th>Table</th><th className="fc-import-plan__num">Rows</th><th className="fc-import-plan__num">Lowest id</th><th className="fc-import-plan__num">Handed out here</th><th>Re-pointed</th><th>Not carried over</th></tr></thead>
              <tbody>
                {remapped.map((table) => (
                  <tr key={table.name}>
                    <td data-label="Table">{ImportPlanView.rowLabel(table)}</td>
                    <td data-label="Rows" className="fc-import-plan__num">{table.rows.toLocaleString()}</td>
                    <td data-label="Lowest id" className="fc-import-plan__num">{table.minId?.toLocaleString()}</td>
                    <td data-label="Handed out here" className="fc-import-plan__num">{table.taken?.toLocaleString()}</td>
                    <td data-label="Re-pointed">{ImportPlanView.repointed(table)}</td>
                    <td data-label="Not carried over">{ImportPlanView.lost(table)}</td>
                  </tr>
                ))}
              </tbody>
            </table>,
          )}

          {ImportPlanView.group(
            'Ids kept', kept.length,
            'Either the table has no serial id and its rows are keyed naturally, or every id in the archive is already above the highest this platform has handed out.',
            <table className="fc-import-plan__table">
              <thead><tr><th>Table</th><th className="fc-import-plan__num">Rows</th><th>Why</th><th className="fc-import-plan__num">Handed out here</th><th>Not carried over</th></tr></thead>
              <tbody>
                {kept.map((table) => (
                  <tr key={table.name}>
                    <td data-label="Table">{ImportPlanView.rowLabel(table)}</td>
                    <td data-label="Rows" className="fc-import-plan__num">{table.rows.toLocaleString()}</td>
                    <td data-label="Why">{table.basis === 'naturalKey' ? 'natural key' : 'all ids above'}</td>
                    <td data-label="Handed out here" className="fc-import-plan__num">{table.taken === null ? '' : table.taken.toLocaleString()}</td>
                    <td data-label="Not carried over">{ImportPlanView.lost(table)}</td>
                  </tr>
                ))}
              </tbody>
            </table>,
          )}

          {ImportPlanView.group(
            'Empty', empty.length,
            `${empty.length.toLocaleString()} table(s) in the archive carry no rows, so nothing is written, lost or re-numbered for them.`,
            <details className="fc-import-plan__empty" open>
              <summary>Which tables</summary>
              {ImportPlanView.emptyByPlugin(empty)}
            </details>,
          )}
        </div>

        {ImportPlanView.warnings(plan.warnings ?? [])}
        {ImportPlanView.exportWarnings(plan.exportWarnings ?? [])}
      </div>
    );
  }
}
