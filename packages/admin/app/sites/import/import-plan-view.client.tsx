import type { ReactNode } from 'react';
import type { IImportPlanTable } from '@/app/sites/import/interfaces/import-plan-table.interface';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { ImportPlanSummary } from '@/app/sites/import/import-plan-summary.client';
import { ImportPlanTables } from '@/app/sites/import/import-plan-tables.client';
import { TenantImportIdMode } from '@fromcode119/core/client';


/**
 * The import plan, as something an operator can actually read before deciding. Presentational.
 *
 * This went through two shapes before this one. First it was one flat table over all 133 entries
 * with a `Why` column of server-written prose — forty rows repeating the same sentence, a skipped
 * table's 25 column names spelled out as prose, half the rows saying "No rows.". That became four
 * grouped tables with the prose gone, which fixed the repetition but still LED with the same thing:
 * physical table names, `LOWEST ID`, `HANDED OUT HERE` — a database engineer's proof of correctness,
 * put in front of an operator who only wants to know what they get and what they lose.
 *
 * This shape leads with that answer instead (`ImportPlanSummary` → `ImportPlanArrivals`): what
 * arrives, as counted, human-labelled things, biggest first; what will not come across, stated once
 * as totals; what was already here. The four mode groups (`ImportPlanTables`) still exist below —
 * Rule Zero forbids hiding anything with an effect — but each table's id mechanics and exact dropped
 * columns now sit behind that ROW's own disclosure (`ImportPlanTableRow`) rather than being the row.
 *
 * Nothing is hidden that has an effect. Every table with rows keeps its own line and every dropped or
 * un-re-pointed column is still listed in full, one click away. The empty group's table names still
 * open by default rather than behind a click — an operator asking "which 62?" should not have to find
 * the disclosure triangle first, only whether to close it.
 */
export class ImportPlanView extends PureReactor {
  @prop declare plan: Record<string, any>;

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
    // What actually ARRIVES — every row with somewhere to go. `withRows` alone double-counts: it
    // still includes the SKIP-mode tables, which are exactly what "Won't come across" counts separately.
    const arriving = withRows.filter((t) => t.mode !== String(TenantImportIdMode.SKIP.value));

    return (
      <div className="fc-import-plan">
        <p className="fc-sites__text">
          Archive of <strong>{manifest.tenant?.slug}</strong> ({manifest.source === 'single-tenant' ? 'a single-tenant deployment' : 'a site'}), exported {manifest.exportedAt} from framework {manifest.frameworkVersion || '?'}.
        </p>

        {(plan.blockers ?? []).length ? (
          <ul className="fc-sites__blockers">{plan.blockers.map((b: string) => <li key={b}>{b}</li>)}</ul>
        ) : null}

        <ImportPlanSummary plan={plan} arriving={arriving} skipped={skipped} remapped={remapped} />

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

        {/*
          * Folded, not removed. Everything the import will do stays reachable — that is Rule Zero —
          * but it is machinery: which ids move, which columns this platform no longer has, which
          * kinds carry nothing. The person deciding whether to press the button needs the sentences
          * above; the person debugging an import needs this, and opens it.
          */}
        <details className="fc-import-plan__detail">
          <summary>Technical detail — every kind of record ({(skipped.length + remapped.length + kept.length + empty.length).toLocaleString()})</summary>
          <ImportPlanTables
            skipped={skipped} remapped={remapped} kept={kept} empty={empty}
            metaRowsExcluded={plan.metaRowsExcluded ?? 0} pluginSettingsRowsExcluded={plan.pluginSettingsRowsExcluded ?? 0}
          />
        </details>

        {ImportPlanView.warnings(plan.warnings ?? [])}
        {ImportPlanView.exportWarnings(plan.exportWarnings ?? [])}
      </div>
    );
  }
}
