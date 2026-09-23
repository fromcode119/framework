import type { IImportPlanTable } from '@/app/sites/import/interfaces/import-plan-table.interface';
import type { IImportPlanSentence } from '@/app/sites/import/interfaces/import-plan-sentence.interface';
import { SystemConstants, TenantImportIdBasis, TenantImportIdMode } from '@fromcode119/core/client';
import { ImportPlanOutcome } from '@/app/sites/import/enums/import-plan-outcome.enum';

/**
 * One kind of record in the archive, said in the words of someone who runs a shop.
 *
 * Every sentence below is DERIVED from a figure the plan already sent — never a default, never a
 * rounding, never a reassurance the plan did not support. Where the plan says nothing, this says
 * nothing: a table with no dropped columns produces no "nothing was dropped" line, it simply is not
 * in the partial group.
 *
 * It names no plugin and no table. `pluginSlug` and `name` are values the plan put there, which is
 * why a plugin written tomorrow reads correctly here with no change to this file.
 */
export class ImportPlanRecord {
  constructor(
    readonly table: IImportPlanTable,
    /** Rows the executor's own filter drops at import time — only ever nonzero for the two framework tables. */
    readonly excludedRows: number,
  ) {}

  /**
   * Builds the list the whole panel reads from, so a count and a sentence can never disagree: both
   * sides of the screen are this one derivation.
   */
  static from(tables: IImportPlanTable[], metaRowsExcluded: number, pluginSettingsRowsExcluded: number): ImportPlanRecord[] {
    return tables.map((table) => {
      if (table.name === SystemConstants.TABLE.META) return new ImportPlanRecord(table, metaRowsExcluded);
      if (table.name === SystemConstants.TABLE.PLUGIN_SETTINGS) return new ImportPlanRecord(table, pluginSettingsRowsExcluded);
      return new ImportPlanRecord(table, 0);
    });
  }

  get isEmpty(): boolean {
    return this.table.rows === 0;
  }

  private get isSkipped(): boolean {
    return this.table.mode === String(TenantImportIdMode.SKIP.value);
  }

  private get isRemapped(): boolean {
    return this.table.mode === String(TenantImportIdMode.REMAP.value);
  }

  /** `rows` still counts the rows the executor filters out, so everything the operator reads nets them off. */
  get arrivingRows(): number {
    return this.table.rows - this.excludedRows;
  }

  /** Its human name, or its physical one when the collection that owns it declared none. */
  get name(): string {
    return this.table.label ?? this.table.name;
  }

  /**
   * Links this import cannot follow AND that something actually moved underneath.
   *
   * An id stored inside a JSON blob is only stale if the row it names was re-numbered. On a table
   * whose ids are kept, the same un-followed column points at the same row it always did — there is
   * nothing to check and nothing was lost. Counting it anyway put `_system_audit_logs`, `people` and
   * 37 other untouched kinds into "something missing" on a real archive, which is the pile this
   * grouping exists to keep empty.
   */
  get hasUnfollowedLinks(): boolean {
    return this.isRemapped && this.table.opaqueJsonColumns.length > 0;
  }

  get outcome(): ImportPlanOutcome {
    if (this.isSkipped) return ImportPlanOutcome.NONE;
    if (this.table.droppedColumns.length || this.hasUnfollowedLinks || this.excludedRows > 0) return ImportPlanOutcome.PARTIAL;
    return ImportPlanOutcome.FULL;
  }

  /**
   * The one phrase that sits at the end of the row — the answer, before anything is expanded.
   *
   * Deliberately the SHORTEST true thing, not a summary of every consequence: a row is a glance, and
   * the sentences below are where the detail lives. When more than one thing is partial, the row
   * names the biggest and the disclosure carries the rest.
   */
  get answer(): string {
    if (this.isSkipped) return this.table.pluginSlug ? `Needs the ${this.table.pluginSlug} add-on` : 'Nowhere to put these';
    const opaque = this.hasUnfollowedLinks ? this.table.opaqueJsonColumns.length : 0;
    const dropped = this.table.droppedColumns.length;
    if (this.excludedRows > 0) return `${this.excludedRows.toLocaleString()} stay as they are here`;
    if (opaque > 0) return `${opaque.toLocaleString()} link${opaque === 1 ? '' : 's'} to check`;
    if (dropped > 0) return `${dropped.toLocaleString()} old field${dropped === 1 ? '' : 's'} dropped`;
    return 'All of them';
  }

  /** What the row says when it is opened. Ordered good news first, then what to look at. */
  get sentences(): IImportPlanSentence[] {
    return this.isSkipped ? this.skippedSentences : [...this.arrivalSentences, ...this.lossSentences];
  }

  private get skippedSentences(): IImportPlanSentence[] {
    const count = this.table.rows.toLocaleString();
    const slug = this.table.pluginSlug;
    const owner = slug
      ? `The ${slug} add-on that knows what these are is not installed or not enabled on this platform, so there is nowhere to put them.`
      : 'Nothing on this platform claims these records, so there is nowhere to put them.';
    const recover = slug
      ? `Install ${slug} and import this archive again — they come across then. Importing now loses nothing you cannot get back later.`
      : 'Importing now loses nothing you cannot get back later: the archive keeps them.';
    return [
      { text: `Your ${count} ${this.name.toLowerCase()} stay in the archive. ${owner}`, warn: false },
      { text: recover, warn: false },
    ];
  }

  private get arrivalSentences(): IImportPlanSentence[] {
    const arriving = this.arrivingRows.toLocaleString();
    const noun = this.name.toLowerCase();
    const opening = this.excludedRows > 0
      ? `${arriving} of the ${this.table.rows.toLocaleString()} ${noun} in the archive belong to this site and come across.`
      : `All ${arriving} ${noun} arrive.`;
    if (!this.isRemapped) return [{ text: opening, warn: false }];
    return [
      { text: opening, warn: false },
      {
        text: 'They are given new numbers on this platform, because this platform already uses the numbers they had. '
          + 'Everything that pointed at them follows automatically — you will not see a broken link.',
        warn: false,
      },
    ];
  }

  /**
   * One sentence per KIND of loss, never one per column: the same field name across a dozen tables is
   * one fact about this platform's schema, and the exact names are in the Technical box below.
   */
  private get lossSentences(): IImportPlanSentence[] {
    const out: IImportPlanSentence[] = [];
    const opaque = this.hasUnfollowedLinks ? this.table.opaqueJsonColumns.length : 0;
    const dropped = this.table.droppedColumns.length;

    if (this.excludedRows > 0) {
      out.push({
        text: `The other ${this.excludedRows.toLocaleString()} belong to a whole installation rather than to one site — things this platform `
          + 'decides for every site it hosts. Those keep whatever this platform already has.',
        warn: true,
      });
    }
    if (opaque > 0) {
      out.push({
        text: `${opaque === 1 ? 'A link' : `${opaque.toLocaleString()} links`} written inside the records themselves still `
          + `point at the old site's numbering. Open one or two afterwards and check ${opaque === 1 ? 'it goes' : 'they go'} where you expect.`,
        warn: true,
      });
    }
    if (dropped > 0) {
      out.push({
        // These are COLUMNS of the records, not settings, and nothing on this platform stands in for them:
        // the value is simply not written. Saying "this platform's own setting applies instead" promised a
        // substitute no code provides. The Technical box below names each one.
        text: `${dropped === 1 ? 'One field' : `${dropped.toLocaleString()} fields`} from an older version `
          + `${dropped === 1 ? 'has' : 'have'} no place on this platform and ${dropped === 1 ? 'is' : 'are'} not carried. `
          + `The records themselves arrive without ${dropped === 1 ? 'it' : 'them'} — Technical below lists which.`,
        warn: true,
      });
    }
    return out;
  }

  /** Exactly what the planner decided about this table's ids, for whoever is debugging an import. */
  get idMechanics(): string {
    const { minId, taken, basis } = this.table;
    if (this.isSkipped) return 'Not planned — the table is skipped';
    if (this.isRemapped) return `Re-numbered — the archive starts at ${minId?.toLocaleString()}, this platform has handed out ${taken?.toLocaleString()}`;
    if (basis === String(TenantImportIdBasis.NATURAL_KEY.value)) return 'Kept — the table has no serial id; rows are keyed naturally';
    if (basis === String(TenantImportIdBasis.EMPTY.value)) return 'Kept — no row here carries a numeric id to compare';
    if (basis === String(TenantImportIdBasis.NO_TABLE.value)) return 'Kept — this platform has no such table to compare against';
    if (basis === String(TenantImportIdBasis.PER_TENANT_KEY.value)) {
      return 'Kept — this site has its own numbering here, so the archive’s ids cannot clash with another site’s';
    }
    return `Kept — every id in the archive is already above what this platform has handed out${taken === null ? '' : ` (${taken.toLocaleString()})`}`;
  }

  /** `column → table` for each reference the remap follows, in the planner's own terms. */
  get followedLinks(): string[] {
    return this.table.repointedReferences.map(
      (ref) => `${ref.path.length ? `${ref.column}[].${ref.path.join('.')}` : ref.column} → ${ref.targetTable}`,
    );
  }
}
