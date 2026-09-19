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

  private get wontCarryOver(): string {
    const { plan, skipped, arriving, remapped } = this;
    const metaRowsExcluded: number = plan.metaRowsExcluded ?? 0;
    const pluginSettingsRowsExcluded: number = plan.pluginSettingsRowsExcluded ?? 0;
    const skippedRows = skipped.reduce((sum, t) => sum + t.rows, 0);

    const droppedTables = arriving.filter((t) => t.droppedColumns.length > 0);
    const droppedColumnsTotal = droppedTables.reduce((sum, t) => sum + t.droppedColumns.length, 0);
    const opaqueJsonTables = remapped.filter((t) => t.opaqueJsonColumns.length > 0);
    const opaqueJsonColumnsTotal = opaqueJsonTables.reduce((sum, t) => sum + t.opaqueJsonColumns.length, 0);

    const parts: string[] = [];
    if (skippedRows > 0) parts.push(`${skippedRows.toLocaleString()} row(s) in ${skipped.length.toLocaleString()} table(s) whose plugin is not installed or enabled here`);
    if (droppedTables.length > 0) parts.push(`${droppedColumnsTotal.toLocaleString()} old field(s) on ${droppedTables.length.toLocaleString()} table(s) this platform no longer has a column for`);
    if (opaqueJsonTables.length > 0) parts.push(`${opaqueJsonColumnsTotal.toLocaleString()} linked id(s) inside a JSON field on ${opaqueJsonTables.length.toLocaleString()} table(s) that will not be updated to the new numbering`);
    if (metaRowsExcluded > 0) parts.push(`${metaRowsExcluded.toLocaleString()} setting(s) that belong to a deployment, not a site`);
    if (pluginSettingsRowsExcluded > 0) parts.push(`${pluginSettingsRowsExcluded.toLocaleString()} setting(s) for a plugin not installed here`);
    if (!parts.length) return 'nothing.';

    // What each part above can actually show, on its own line, one click away: dropped columns,
    // opaque JSON columns and the two excluded-row counts all land on a table that has its own
    // `<details>`. A skipped table never does — SKIP-mode tables carry no id mechanics to disclose —
    // so it is already named, with its row count, under "Not imported" below; there is nothing to
    // expand there because nothing is folded.
    const expandable = droppedTables.length > 0 || opaqueJsonTables.length > 0 || metaRowsExcluded > 0 || pluginSettingsRowsExcluded > 0;
    const namedBelow = skippedRows > 0;
    let trailer = '';
    if (expandable && namedBelow) trailer = ' Expand a table below for exactly which columns or rows; a skipped table is already named, with its row count, under "Not imported".';
    else if (expandable) trailer = ' Expand a table below for exactly which.';
    else if (namedBelow) trailer = ' See "Not imported" below for exactly which.';
    return `${parts.join('; ')}.${trailer}`;
  }

  private get alreadyHere(): string {
    const { plan, remapped } = this;
    const users = plan.users;
    const files = plan.files;

    const peopleParts: string[] = [];
    if (users.existing > 0) peopleParts.push(`${users.existing.toLocaleString()} of the people in the archive already have an account here and will not be duplicated`);
    if (users.toCreate > 0) peopleParts.push(`${users.toCreate.toLocaleString()} new account(s) will be created`);
    const peopleClause = peopleParts.length ? `${peopleParts.join('; ')}. ` : '';

    let filesClause = '';
    if (files.count > 0) {
      if (files.colliding === files.count) filesClause = ' Every file in the archive is already here by name — if this archive was imported before, these will be a second copy of each.';
      else if (files.colliding > 0) filesClause = ` ${files.colliding.toLocaleString()} of ${files.count.toLocaleString()} file(s) are already here by name and will be saved alongside them under a suffixed name.`;
    }

    return `${peopleClause}Nothing already on this platform is replaced. ${remapped.length.toLocaleString()} table(s) get re-numbered ids.${filesClause}`;
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
        <p className="fc-sites__text"><strong>Won&rsquo;t come across</strong> — {this.wontCarryOver}</p>
        <p className="fc-sites__text"><strong>Already here</strong> — {this.alreadyHere}</p>
      </div>
    );
  }
}
