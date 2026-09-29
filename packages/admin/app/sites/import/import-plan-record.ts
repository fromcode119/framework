import type { IImportPlanTable } from '@/app/sites/import/interfaces/import-plan-table.interface';
import type { IImportPlanSentence } from '@/app/sites/import/interfaces/import-plan-sentence.interface';
import { SystemConstants, TenantImportIdBasis, TenantImportIdMode } from '@fromcode119/core/client';
import { ImportPlanOutcome } from '@/app/sites/import/enums/import-plan-outcome.enum';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

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
    if (this.isSkipped) {
      return this.table.pluginSlug
        ? AdminI18n.t('sites.importPlan.needsAddon', { addon: this.table.pluginSlug })
        : AdminI18n.t('sites.importPlan.nowhereToPut');
    }
    const opaque = this.hasUnfollowedLinks ? this.table.opaqueJsonColumns.length : 0;
    const dropped = this.table.droppedColumns.length;
    if (this.excludedRows > 0) return AdminI18n.t('sites.importPlan.stayAsTheyAre', { count: this.excludedRows.toLocaleString() });
    if (opaque > 0) {
      return opaque === 1
        ? AdminI18n.t('sites.importPlan.linkToCheckOne')
        : AdminI18n.t('sites.importPlan.linksToCheck', { count: opaque.toLocaleString() });
    }
    if (dropped > 0) {
      return dropped === 1
        ? AdminI18n.t('sites.importPlan.oldFieldDroppedOne')
        : AdminI18n.t('sites.importPlan.oldFieldsDropped', { count: dropped.toLocaleString() });
    }
    return AdminI18n.t('sites.importPlan.allOfThem');
  }

  /** What the row says when it is opened. Ordered good news first, then what to look at. */
  get sentences(): IImportPlanSentence[] {
    return this.isSkipped ? this.skippedSentences : [...this.arrivalSentences, ...this.lossSentences];
  }

  private get skippedSentences(): IImportPlanSentence[] {
    const count = this.table.rows.toLocaleString();
    const slug = this.table.pluginSlug;
    const owner = slug
      ? AdminI18n.t('sites.importPlan.addonMissing', { addon: slug })
      : AdminI18n.t('sites.importPlan.nothingClaims');
    const recover = slug
      ? AdminI18n.t('sites.importPlan.installAndReimport', { addon: slug })
      : AdminI18n.t('sites.importPlan.archiveKeepsThem');
    return [
      { text: `${AdminI18n.t('sites.importPlan.stayInArchive', { count, noun: this.name.toLowerCase() })} ${owner}`, warn: false },
      { text: recover, warn: false },
    ];
  }

  private get arrivalSentences(): IImportPlanSentence[] {
    const arriving = this.arrivingRows.toLocaleString();
    const noun = this.name.toLowerCase();
    const opening = this.excludedRows > 0
      ? AdminI18n.t('sites.importPlan.someArrive', { arriving, total: this.table.rows.toLocaleString(), noun })
      : AdminI18n.t('sites.importPlan.allArrive', { arriving, noun });
    if (!this.isRemapped) return [{ text: opening, warn: false }];
    return [
      { text: opening, warn: false },
      {
        text: AdminI18n.t('sites.importPlan.renumbered'),
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
        text: AdminI18n.t('sites.importPlan.installationWide', { count: this.excludedRows.toLocaleString() }),
        warn: true,
      });
    }
    if (opaque > 0) {
      out.push({
        text: opaque === 1
          ? AdminI18n.t('sites.importPlan.unfollowedLinkOne')
          : AdminI18n.t('sites.importPlan.unfollowedLinks', { count: opaque.toLocaleString() }),
        warn: true,
      });
    }
    if (dropped > 0) {
      out.push({
        // These are COLUMNS of the records, not settings, and nothing on this platform stands in for them:
        // the value is simply not written. Saying "this platform's own setting applies instead" promised a
        // substitute no code provides. The Technical box below names each one.
        text: dropped === 1
          ? AdminI18n.t('sites.importPlan.droppedFieldOne')
          : AdminI18n.t('sites.importPlan.droppedFields', { count: dropped.toLocaleString() }),
        warn: true,
      });
    }
    return out;
  }

  /** Exactly what the planner decided about this table's ids, for whoever is debugging an import. */
  get idMechanics(): string {
    const { minId, taken, basis } = this.table;
    if (this.isSkipped) return AdminI18n.t('sites.importPlan.ids.skipped');
    if (this.isRemapped) return AdminI18n.t('sites.importPlan.ids.renumbered', { min: minId?.toLocaleString(), taken: taken?.toLocaleString() });
    if (basis === String(TenantImportIdBasis.NATURAL_KEY.value)) return AdminI18n.t('sites.importPlan.ids.naturalKey');
    if (basis === String(TenantImportIdBasis.EMPTY.value)) return AdminI18n.t('sites.importPlan.ids.empty');
    if (basis === String(TenantImportIdBasis.NO_TABLE.value)) return AdminI18n.t('sites.importPlan.ids.noTable');
    if (basis === String(TenantImportIdBasis.PER_TENANT_KEY.value)) return AdminI18n.t('sites.importPlan.ids.perTenant');
    return taken === null
      ? AdminI18n.t('sites.importPlan.ids.above')
      : AdminI18n.t('sites.importPlan.ids.aboveTaken', { taken: taken.toLocaleString() });
  }

  /** `column → table` for each reference the remap follows, in the planner's own terms. */
  get followedLinks(): string[] {
    return this.table.repointedReferences.map(
      (ref) => `${ref.path.length ? `${ref.column}[].${ref.path.join('.')}` : ref.column} → ${ref.targetTable}`,
    );
  }
}
