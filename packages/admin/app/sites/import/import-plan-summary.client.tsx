import type { ReactNode } from 'react';
import type { IImportPlanTable } from '@/app/sites/import/interfaces/import-plan-table.interface';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { ImportPlanArrivals } from '@/app/sites/import/import-plan-arrivals.client';

/**
 * The three questions an operator has before deciding: what shows up, what does not, what was
 * already here. Every number in it comes from `ImportPlanTables`' own groups below (never a second
 * source of truth) — a headline total here (e.g. "198 rows … whose plugin is not installed") is a
 * SUM of numbers a table row below also shows on its own line, deliberately: the per-row figure is
 * corroboration an operator can check without trusting this summary alone, not a second source the
 * headline could drift from.
 *
 * "What arrives" is answered by `ImportPlanArrivals`, as things and counts. What follows here is the
 * two questions that are about CONSEQUENCE rather than inventory — "Won't come across" and "Already
 * here" — stated once, as totals. Most of those totals point at a specific table's own `<details>`
 * for the exact columns/rows; a skipped table has no such disclosure (its row IS the whole story —
 * `basis`/`minId`/`taken` are never computed for it), so `wontCarryOver` below says precisely which
 * part is reachable by expanding a row and which is just named in the "Not imported" group as-is.
 */
export class ImportPlanSummary extends PureReactor {
  @prop declare plan: Record<string, any>;
  /** Rows with somewhere to go: `rows > 0` and NOT skipped. */
  @prop declare arriving: IImportPlanTable[];
  /** Rows with nowhere to go: `rows > 0` and skipped (the plugin that owns them is not installed/enabled). */
  @prop declare skipped: IImportPlanTable[];
  /** Rows whose ids get re-numbered. */
  @prop declare remapped: IImportPlanTable[];

  /**
   * What an operator should go and LOOK at afterwards, in the words of someone who runs a shop.
   *
   * Not a column-by-table tally: the same field name repeated across a dozen tables is one fact
   * about this platform's schema, and an id inside a stored blob means "a link may point at the old
   * thing", not "an opaque JSON column". Each sentence is one consequence, rendered only when the
   * plan actually reports it, and every figure in it is a sum of rows the table below also shows.
   */
  private get worthKnowing(): string[] {
    const { plan, skipped, arriving, remapped } = this;
    const out: string[] = [];

    const skippedRows = skipped.reduce((sum, t) => sum + t.rows, 0);
    if (skippedRows > 0) {
      out.push(`${skippedRows.toLocaleString()} record(s) have nowhere to go until the add-on that owns them is installed here. Install it, then import again, and they come across too.`);
    }

    const opaqueTables = remapped.filter((t) => t.opaqueJsonColumns.length > 0);
    if (opaqueTables.length > 0) {
      out.push('Some links stored inside page content and product descriptions still point at their old numbering. Worth a look at related products and page links afterwards.');
    }

    const droppedTables = arriving.filter((t) => t.droppedColumns.length > 0);
    if (droppedTables.length > 0) {
      out.push('A few older fields have no home on this platform any more and are not carried. The records themselves arrive; open the detail below for exactly which fields.');
    }

    const metaRowsExcluded: number = plan.metaRowsExcluded ?? 0;
    const pluginSettingsRowsExcluded: number = plan.pluginSettingsRowsExcluded ?? 0;
    if (metaRowsExcluded + pluginSettingsRowsExcluded > 0) {
      out.push('Settings that belong to a whole installation rather than to one shop stay as this platform has them.');
    }

    return out;
  }

  /**
   * Whether the archive carries any setting with a secret at all — the planner already knows this
   * (`TenantImportPlanner.warnUnreadableSecrets`) and says so with this exact substring in both of
   * its warning templates; there is no separate count to gate on without inventing one, so this
   * reuses the planner's own signal rather than keeping a second copy of the same fact.
   */
  private get hasSecrets(): boolean {
    return (this.plan.warnings ?? []).some((w: string) => w.includes('carry a secret'));
  }

  /** Whether the credentials arrive working, which the archive itself records. */
  private get settingsSentence(): string {
    return this.plan.manifest?.secretsSealed
      ? 'Your integrations arrive configured and working — nothing to enter again.'
      : 'Your integrations arrive, but their passwords were locked to the installation they came from. Open Settings \u2192 Integrations afterwards to enter them again.';
  }

  private get alreadyHere(): string {
    const { plan } = this;
    const users = plan.users;
    const files = plan.files;

    const peopleParts: string[] = [];
    if (users.existing > 0) peopleParts.push(`${users.existing.toLocaleString()} of the people in the archive already have an account here and will not be duplicated`);
    if (users.toCreate > 0) peopleParts.push(`${users.toCreate.toLocaleString()} new account(s) will be created`);
    const peopleClause = peopleParts.length ? `${peopleParts.join('; ')}. ` : '';

    let filesClause = '';
    if (files.count > 0) {
      if (files.colliding > 0) filesClause = ' Files whose name is already taken are saved alongside, never replacing what is here, and everything that pointed at them is updated to match.';
    }

    return `${peopleClause}Nothing already on this platform is replaced.${filesClause}`;
  }

  render(): ReactNode {
    const { plan, arriving } = this;

    return (
      <div className="fc-import-plan__summary">
        <ImportPlanArrivals
          arriving={arriving}
          users={plan.users}
          files={plan.files}
          metaRowsExcluded={plan.metaRowsExcluded ?? 0}
          pluginSettingsRowsExcluded={plan.pluginSettingsRowsExcluded ?? 0}
        />
        <p className="fc-sites__text"><strong>Nothing here is deleted or overwritten</strong> — {this.alreadyHere}</p>
        {this.hasSecrets ? (
          <p className="fc-sites__text"><strong>Your settings</strong> — {this.settingsSentence}</p>
        ) : null}
        {this.worthKnowing.length > 0 ? (
          <div className="fc-import-plan__worth-knowing">
            <span className="fc-site-form__label">Worth knowing</span>
            <ul className="fc-sites__warnings">
              {this.worthKnowing.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }
}
