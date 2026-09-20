import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { ImportPlanRecord } from '@/app/sites/import/import-plan-record';
import { ImportPlanArrivals } from '@/app/sites/import/import-plan-arrivals.client';
import { ImportPlanOutcome } from '@/app/sites/import/enums/import-plan-outcome.enum';

/**
 * The three questions an operator has before deciding: what shows up, what does not, what was
 * already here. Every number in it comes from the same `ImportPlanRecord` list the detail panel
 * below reads (never a second source of truth), so a headline total here is a SUM of figures a row
 * below also shows on its own line — corroboration an operator can check, not a figure that could
 * drift from the one beside it.
 *
 * "What arrives" is answered by `ImportPlanArrivals`, as things and counts. What follows here is the
 * questions about CONSEQUENCE rather than inventory, each as its own card: a run-in paragraph gave
 * one sentence of reassurance and four of homework the same weight, so the reader had to parse the
 * block to find out whether there was anything to do.
 */
export class ImportPlanSummary extends PureReactor {
  @prop declare plan: Record<string, any>;
  /** Every kind in the archive, already classified. */
  @prop declare records: ImportPlanRecord[];
  /** Those with rows and somewhere to put them. */
  @prop declare arriving: ImportPlanRecord[];

  /**
   * What an operator should go and LOOK at afterwards, in the words of someone who runs a shop.
   *
   * Not a column-by-table tally: the same field name repeated across a dozen tables is one fact
   * about this platform's schema, and an id inside a stored blob means "a link may point at the old
   * thing", not "an opaque JSON column". Each line is one consequence, rendered only when the plan
   * actually reports it, and every figure in it is a sum of rows the detail panel also shows.
   */
  private get worthKnowing(): string[] {
    const { plan, records } = this;
    const out: string[] = [];

    const skipped = records.filter((record) => record.outcome === ImportPlanOutcome.NONE);
    const skippedRows = skipped.reduce((sum, record) => sum + record.table.rows, 0);
    if (skippedRows > 0) {
      out.push(`${skippedRows.toLocaleString()} record(s) have nowhere to go until the add-on that owns them is installed here. Install it, then import again, and they come across too.`);
    }
    // Only where the ids actually moved: an un-followed id on a table whose numbering was kept still
    // points at the row it always did, so telling the operator to go and check it is homework for
    // nothing — see `ImportPlanRecord.hasUnfollowedLinks`.
    if (this.arriving.some((record) => record.hasUnfollowedLinks)) {
      out.push('Some links stored inside page content and product descriptions still point at their old numbering. Worth a look at related products and page links afterwards.');
    }
    if (this.arriving.some((record) => record.table.droppedColumns.length > 0)) {
      out.push('A few older fields have no home on this platform any more and are not carried. The records themselves arrive; open the detail below for exactly which fields.');
    }
    const excluded = (plan.metaRowsExcluded ?? 0) + (plan.pluginSettingsRowsExcluded ?? 0);
    if (excluded > 0) {
      out.push('Settings that belong to a whole installation rather than to one shop stay as this platform has them.');
    }
    return out;
  }

  /**
   * Whether the credentials arrive working — the PLAN's measured answer, not the archive's own note.
   *
   * `manifest.secretsSealed` is written at export time and cannot know the key of the platform
   * reading it. An archive exported and re-imported on the same platform is never sealed and its
   * secrets open fine, so reading the manifest alone told that operator to go and re-enter every
   * password that already worked. `plan.secretsArrive` is the import actually trying to open them.
   */
  private get settingsArrive(): boolean {
    return this.plan.secretsArrive !== false;
  }

  private get settingsSentence(): string {
    return this.settingsArrive
      ? 'Your integrations arrive configured and working — nothing to enter again.'
      : 'Your integrations arrive, but their passwords were locked to the installation they came from. Open Settings → Integrations afterwards to enter them again.';
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
    if (files.count > 0 && files.colliding > 0) {
      filesClause = ' Files whose name is already taken are saved alongside, never replacing what is here, and everything that pointed at them is updated to match.';
    }

    return `${peopleClause}Nothing already on this platform is replaced.${filesClause}`;
  }

  /**
   * One card per statement, with a mark that says whether it is reassurance or something to do.
   *
   * These were three run-in paragraphs in a single column. A card each separates "this is fine" from
   * "check this" at a glance, and gives the homework list room to be a list instead of four
   * sentences hanging off the end of the third paragraph.
   */
  private static note(reassuring: boolean, title: string, body: string, more: string[] = []): ReactNode {
    return (
      <div className={`fc-import-plan__note fc-import-plan__note--${reassuring ? 'ok' : 'act'}`} key={title}>
        <div className="fc-import-plan__note-head">
          <span className="fc-import-plan__note-mark" aria-hidden="true">{reassuring ? '✓' : '!'}</span>
          <b>{title}</b>
        </div>
        {more.length ? (
          <ul className="fc-import-plan__note-list">
            <li>{body}</li>
            {more.map((line) => <li key={line}>{line}</li>)}
          </ul>
        ) : <p className="fc-import-plan__note-body">{body}</p>}
      </div>
    );
  }

  render(): ReactNode {
    const { plan } = this;
    const worthKnowing = this.worthKnowing;

    return (
      <div className="fc-import-plan__summary">
        <ImportPlanArrivals
          records={this.records}
          arriving={this.arriving}
          users={plan.users}
          files={plan.files}
        />
        <span className="fc-site-form__label">Before you press it</span>
        <div className="fc-import-plan__notes">
          {ImportPlanSummary.note(true, 'Nothing here is replaced', this.alreadyHere)}
          {ImportPlanSummary.note(
            this.settingsArrive,
            this.settingsArrive ? 'Your settings come with it' : 'Your settings need a password',
            this.settingsSentence,
          )}
          {worthKnowing.length > 0
            ? ImportPlanSummary.note(false, 'Check after importing', worthKnowing[0], worthKnowing.slice(1))
            : null}
        </div>
      </div>
    );
  }
}
