import type { IPluginDefaultPageContractAssociationPersistResult } from '@core/default-page-contract/interfaces/plugin-default-page-contract-association-persist-result.interface';
import type { IPluginDefaultPageContractBackfillAssociationMaps } from '@core/default-page-contract/interfaces/plugin-default-page-contract-backfill-association-maps.interface';
import type { IPluginDefaultPageContractBackfillAssociationRecord } from '@core/default-page-contract/interfaces/plugin-default-page-contract-backfill-association-record.interface';
import type { IPluginDefaultPageContractPageSnapshot } from '@core/default-page-contract/interfaces/plugin-default-page-contract-page-snapshot.interface';
import type { IPluginDefaultPageContractMaterializationExecutionEntrySummary } from '@core/default-page-contract/interfaces/plugin-default-page-contract-materialization-execution-entry-summary.interface';
import type { IPluginDefaultPageContractMaterializationExecutionInput } from '@core/default-page-contract/interfaces/plugin-default-page-contract-materialization-execution-input.interface';
import type { IPluginDefaultPageContractMaterializationExecutionReport } from '@core/default-page-contract/interfaces/plugin-default-page-contract-materialization-execution-report.interface';
import type { IPluginDefaultPageContractMaterializationExecutionReportSummary } from '@core/default-page-contract/interfaces/plugin-default-page-contract-materialization-execution-report-summary.interface';
import type { IPluginDefaultPageContractMaterializationPlanEntry } from '@core/default-page-contract/interfaces/plugin-default-page-contract-materialization-plan-entry.interface';
import { BaseService } from '@core/services/base-service';
import { SeedPageService } from '@core/services/seed-page-service';
import { PluginDefaultPageBackfillAssociationService } from '@core/services/default-page-contract/plugin-default-page-backfill-association-service';
import { PluginDefaultPageContractMaterializationAction } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-action.enum';
import { PluginDefaultPageContractMaterializationMode } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-mode.enum';
import { PluginDefaultPageContractMaterializationStatus } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-status.enum';
import { PluginDefaultPageContractAssociationPersistStatus } from '@core/default-page-contract/enums/plugin-default-page-contract-association-persist-status.enum';
import { PluginDefaultPageContractMaterializationExecutionOutcome } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-execution-outcome.enum';

export class PluginDefaultPageMaterializationExecutorService extends BaseService {
  private readonly seedPageService = new SeedPageService();

  constructor(private readonly associationService: PluginDefaultPageBackfillAssociationService) {
    super();
  }

  get serviceName(): string {
    return 'PluginDefaultPageMaterializationExecutorService';
  }

  async execute(input: IPluginDefaultPageContractMaterializationExecutionInput): Promise<IPluginDefaultPageContractMaterializationExecutionReport> {
    const entries = input.plan.entries
      .slice()
      .sort((left, right) => left.canonicalKey.localeCompare(right.canonicalKey));
    const reportEntries: IPluginDefaultPageContractMaterializationExecutionEntrySummary[] = [];

    for (const entry of entries) {
      reportEntries.push(await this.executeEntry(entry, input));
    }

    return {
      entries: reportEntries,
      summary: this.createSummary(reportEntries),
    };
  }

  private async executeEntry(
    entry: IPluginDefaultPageContractMaterializationPlanEntry,
    input: IPluginDefaultPageContractMaterializationExecutionInput,
  ): Promise<IPluginDefaultPageContractMaterializationExecutionEntrySummary> {
    if (!this.isExecutableEntry(entry)) {
      return this.createEntrySummary(entry, PluginDefaultPageContractMaterializationExecutionOutcome.SKIPPED, entry.reasons);
    }

    if (entry.action === PluginDefaultPageContractMaterializationAction.CREATE_MISSING) {
      return this.executeCreateMissingEntry(entry, input);
    }

    if (entry.matchedPageId === undefined) {
      return this.createEntrySummary(entry, PluginDefaultPageContractMaterializationExecutionOutcome.FAILED, this.appendReason(entry.reasons, 'matched-page-id-missing'));
    }

    const pageId = entry.matchedPageId;
    const freshPage = await input.pageLookupRepository.findPageById(pageId);

    if (!freshPage) {
      return this.createEntrySummary(entry, PluginDefaultPageContractMaterializationExecutionOutcome.FAILED, this.appendReason(entry.reasons, 'matched-page-missing'));
    }

    if (!this.matchesLookupCandidates(entry, freshPage)) {
      return this.createEntrySummary(
        entry,
        PluginDefaultPageContractMaterializationExecutionOutcome.FAILED,
        this.appendReason(entry.reasons, 'matched-page-no-longer-matches-lookup-candidates'),
      );
    }

    const associationMaps = this.associationService.createMaps(
      await input.associationSnapshotRepository.getAssociationSnapshot(),
    );

    const conflictReasons = this.getAssociationConflictReasons(entry, associationMaps, pageId);
    if (conflictReasons.length) {
      return this.createEntrySummary(entry, PluginDefaultPageContractMaterializationExecutionOutcome.FAILED, conflictReasons);
    }

    if (this.hasSameAssociation(associationMaps, entry.canonicalKey, pageId)) {
      return this.createEntrySummary(entry, PluginDefaultPageContractMaterializationExecutionOutcome.NOOP, entry.reasons, pageId);
    }

    const persistResult = await input.associationPersistRepository.persistAssociation({
      canonicalKey: entry.canonicalKey,
      pageId,
    });

    return this.createPersistSummary(entry, pageId, persistResult);
  }

  private isExecutableEntry(entry: IPluginDefaultPageContractMaterializationPlanEntry): boolean {
    return entry.materializationMode === PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT
      && entry.status === PluginDefaultPageContractMaterializationStatus.READY
      && (entry.action === PluginDefaultPageContractMaterializationAction.ADOPT_EXISTING || entry.action === PluginDefaultPageContractMaterializationAction.CREATE_MISSING);
  }

  private async executeCreateMissingEntry(
    entry: IPluginDefaultPageContractMaterializationPlanEntry,
    input: IPluginDefaultPageContractMaterializationExecutionInput,
  ): Promise<IPluginDefaultPageContractMaterializationExecutionEntrySummary> {
    if (!entry.createPayload) {
      return this.createEntrySummary(entry, PluginDefaultPageContractMaterializationExecutionOutcome.FAILED, this.appendReason(entry.reasons, 'create-payload-missing'));
    }

    const createdPage = await input.pageCreateRepository.createPage(entry.createPayload);
    if (!createdPage) {
      return this.createEntrySummary(entry, PluginDefaultPageContractMaterializationExecutionOutcome.FAILED, this.appendReason(entry.reasons, 'created-page-missing'));
    }

    if (createdPage.id === undefined || createdPage.id === null) {
      return this.createEntrySummary(entry, PluginDefaultPageContractMaterializationExecutionOutcome.FAILED, this.appendReason(entry.reasons, 'created-page-id-missing'));
    }

    if (!this.matchesLookupCandidates(entry, createdPage)) {
      return this.createEntrySummary(
        entry,
        PluginDefaultPageContractMaterializationExecutionOutcome.FAILED,
        this.appendReason(entry.reasons, 'created-page-no-longer-matches-lookup-candidates'),
        createdPage.id,
      );
    }

    const associationMaps = this.associationService.createMaps(
      await input.associationSnapshotRepository.getAssociationSnapshot(),
    );
    const conflictReasons = this.getAssociationConflictReasons(entry, associationMaps, createdPage.id);
    if (conflictReasons.length) {
      return this.createEntrySummary(entry, PluginDefaultPageContractMaterializationExecutionOutcome.FAILED, conflictReasons, createdPage.id);
    }

    if (this.hasSameAssociation(associationMaps, entry.canonicalKey, createdPage.id)) {
      return this.createEntrySummary(entry, PluginDefaultPageContractMaterializationExecutionOutcome.NOOP, entry.reasons, createdPage.id);
    }

    const persistResult = await input.associationPersistRepository.persistAssociation({
      canonicalKey: entry.canonicalKey,
      pageId: createdPage.id,
    });

    return this.createPersistSummary(entry, createdPage.id, persistResult);
  }

  private getAssociationConflictReasons(
    entry: IPluginDefaultPageContractMaterializationPlanEntry,
    associationMaps: IPluginDefaultPageContractBackfillAssociationMaps,
    pageId: number | string,
  ): string[] {
    const pageIdKey = String(pageId);
    const canonicalRecord = associationMaps.byCanonicalKey.get(entry.canonicalKey);
    const pageRecord = associationMaps.byPageId.get(pageIdKey);

    if (associationMaps.conflicts.canonicalKeys.has(entry.canonicalKey) || associationMaps.conflicts.pageIds.has(pageIdKey)) {
      return this.appendReason(entry.reasons, 'conflicting-association-snapshot');
    }

    if (canonicalRecord && String(canonicalRecord.pageId) !== pageIdKey) {
      return this.appendReason(entry.reasons, 'contract-already-associated-to-different-page');
    }

    if (pageRecord && pageRecord.canonicalKey !== entry.canonicalKey) {
      return this.appendReason(entry.reasons, 'matched-page-already-associated-to-different-contract');
    }

    return [];
  }

  private matchesLookupCandidates(
    entry: IPluginDefaultPageContractMaterializationPlanEntry,
    page: IPluginDefaultPageContractPageSnapshot,
  ): boolean {
    const customPermalinkCandidates = this.seedPageService.buildPageLookupCandidates([], {
      customPermalink: page.customPermalink,
    });
    if (this.hasCandidateMatch(entry.lookupCandidates, customPermalinkCandidates)) {
      return true;
    }

    const slugCandidates = this.seedPageService.buildPageLookupCandidates([], {
      slug: page.slug,
    });

    return this.hasCandidateMatch(entry.lookupCandidates, slugCandidates);
  }

  private hasCandidateMatch(lookupCandidates: string[], pageCandidates: string[]): boolean {
    return pageCandidates.some((candidate) => lookupCandidates.includes(candidate));
  }

  private hasSameAssociation(
    associationMaps: IPluginDefaultPageContractBackfillAssociationMaps,
    canonicalKey: string,
    pageId: number | string,
  ): boolean {
    const canonicalRecord = associationMaps.byCanonicalKey.get(canonicalKey);
    const pageRecord = associationMaps.byPageId.get(String(pageId));

    return this.isSameAssociation(canonicalRecord, canonicalKey, pageId)
      || this.isSameAssociation(pageRecord, canonicalKey, pageId);
  }

  private isSameAssociation(
    record: IPluginDefaultPageContractBackfillAssociationRecord | undefined,
    canonicalKey: string,
    pageId: number | string,
  ): boolean {
    return Boolean(record) && record?.canonicalKey === canonicalKey && String(record.pageId) === String(pageId);
  }

  private createPersistSummary(
    entry: IPluginDefaultPageContractMaterializationPlanEntry,
    pageId: number | string,
    persistResult: IPluginDefaultPageContractAssociationPersistResult,
  ): IPluginDefaultPageContractMaterializationExecutionEntrySummary {
    if (persistResult.status === PluginDefaultPageContractAssociationPersistStatus.APPLIED) {
      return this.createEntrySummary(entry, PluginDefaultPageContractMaterializationExecutionOutcome.APPLIED, entry.reasons, pageId);
    }

    if (persistResult.status === PluginDefaultPageContractAssociationPersistStatus.NOOP) {
      return this.createEntrySummary(entry, PluginDefaultPageContractMaterializationExecutionOutcome.NOOP, entry.reasons, pageId);
    }

    return this.createEntrySummary(
      entry,
      PluginDefaultPageContractMaterializationExecutionOutcome.FAILED,
      this.appendReason(entry.reasons, persistResult.reason || 'association-persist-conflict'),
      pageId,
    );
  }

  private createEntrySummary(
    entry: IPluginDefaultPageContractMaterializationPlanEntry,
    executionOutcome: PluginDefaultPageContractMaterializationExecutionOutcome,
    reasons: string[],
    matchedPageId?: number | string,
  ): IPluginDefaultPageContractMaterializationExecutionEntrySummary {
    return {
      canonicalKey: entry.canonicalKey,
      namespace: entry.namespace,
      pluginSlug: entry.pluginSlug,
      key: entry.key,
      action: entry.action,
      status: entry.status,
      materializationMode: entry.materializationMode,
      matchedPageId,
      executionOutcome,
      reasons: [...reasons],
    };
  }

  private createSummary(
    entries: IPluginDefaultPageContractMaterializationExecutionEntrySummary[],
  ): IPluginDefaultPageContractMaterializationExecutionReportSummary {
    const summary: IPluginDefaultPageContractMaterializationExecutionReportSummary = {
      total: entries.length,
      byOutcome: {
        applied: 0,
        failed: 0,
        noop: 0,
        skipped: 0,
      },
    };

    for (const entry of entries) {
      summary.byOutcome[entry.executionOutcome.value] += 1;
    }

    return summary;
  }

  private appendReason(existingReasons: string[], nextReason: string): string[] {
    return Array.from(
      new Set(
        [...(existingReasons || []), nextReason]
          .map((reason) => String(reason || '').trim())
          .filter(Boolean),
      ),
    );
  }
}