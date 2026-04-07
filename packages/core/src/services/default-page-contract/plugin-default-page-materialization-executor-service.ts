import type {
  PluginDefaultPageContractAssociationPersistResult,
  PluginDefaultPageContractBackfillAssociationMaps,
  PluginDefaultPageContractBackfillAssociationRecord,
  PluginDefaultPageContractPageSnapshot,
  PluginDefaultPageContractMaterializationExecutionEntrySummary,
  PluginDefaultPageContractMaterializationExecutionInput,
  PluginDefaultPageContractMaterializationExecutionOutcome,
  PluginDefaultPageContractMaterializationExecutionReport,
  PluginDefaultPageContractMaterializationExecutionReportSummary,
  PluginDefaultPageContractMaterializationPlanEntry,
} from '../../types';
import { BaseService } from '../base-service';
import { SeedPageService } from '../seed-page-service';
import { PluginDefaultPageBackfillAssociationService } from './plugin-default-page-backfill-association-service';

export class PluginDefaultPageMaterializationExecutorService extends BaseService {
  private readonly seedPageService = new SeedPageService();

  constructor(private readonly associationService: PluginDefaultPageBackfillAssociationService) {
    super();
  }

  get serviceName(): string {
    return 'PluginDefaultPageMaterializationExecutorService';
  }

  async execute(input: PluginDefaultPageContractMaterializationExecutionInput): Promise<PluginDefaultPageContractMaterializationExecutionReport> {
    const entries = input.plan.entries
      .slice()
      .sort((left, right) => left.canonicalKey.localeCompare(right.canonicalKey));
    const reportEntries: PluginDefaultPageContractMaterializationExecutionEntrySummary[] = [];

    for (const entry of entries) {
      reportEntries.push(await this.executeEntry(entry, input));
    }

    return {
      entries: reportEntries,
      summary: this.createSummary(reportEntries),
    };
  }

  private async executeEntry(
    entry: PluginDefaultPageContractMaterializationPlanEntry,
    input: PluginDefaultPageContractMaterializationExecutionInput,
  ): Promise<PluginDefaultPageContractMaterializationExecutionEntrySummary> {
    if (!this.isExecutableEntry(entry)) {
      return this.createEntrySummary(entry, 'skipped', entry.reasons);
    }

    if (entry.matchedPageId === undefined) {
      return this.createEntrySummary(entry, 'failed', this.appendReason(entry.reasons, 'matched-page-id-missing'));
    }

    const pageId = entry.matchedPageId;
    const freshPage = await input.pageLookupRepository.findPageById(pageId);

    if (!freshPage) {
      return this.createEntrySummary(entry, 'failed', this.appendReason(entry.reasons, 'matched-page-missing'));
    }

    if (!this.matchesLookupCandidates(entry, freshPage)) {
      return this.createEntrySummary(
        entry,
        'failed',
        this.appendReason(entry.reasons, 'matched-page-no-longer-matches-lookup-candidates'),
      );
    }

    const associationMaps = this.associationService.createMaps(
      await input.associationSnapshotRepository.getAssociationSnapshot(),
    );

    const conflictReasons = this.getAssociationConflictReasons(entry, associationMaps, pageId);
    if (conflictReasons.length) {
      return this.createEntrySummary(entry, 'failed', conflictReasons);
    }

    if (this.hasSameAssociation(associationMaps, entry.canonicalKey, pageId)) {
      return this.createEntrySummary(entry, 'noop', entry.reasons, pageId);
    }

    const persistResult = await input.associationPersistRepository.persistAssociation({
      canonicalKey: entry.canonicalKey,
      pageId,
    });

    return this.createPersistSummary(entry, pageId, persistResult);
  }

  private isExecutableEntry(entry: PluginDefaultPageContractMaterializationPlanEntry): boolean {
    return entry.materializationMode === 'singleton-document'
      && entry.action === 'adopt-existing'
      && entry.status === 'ready';
  }

  private getAssociationConflictReasons(
    entry: PluginDefaultPageContractMaterializationPlanEntry,
    associationMaps: PluginDefaultPageContractBackfillAssociationMaps,
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
    entry: PluginDefaultPageContractMaterializationPlanEntry,
    page: PluginDefaultPageContractPageSnapshot,
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
    associationMaps: PluginDefaultPageContractBackfillAssociationMaps,
    canonicalKey: string,
    pageId: number | string,
  ): boolean {
    const canonicalRecord = associationMaps.byCanonicalKey.get(canonicalKey);
    const pageRecord = associationMaps.byPageId.get(String(pageId));

    return this.isSameAssociation(canonicalRecord, canonicalKey, pageId)
      || this.isSameAssociation(pageRecord, canonicalKey, pageId);
  }

  private isSameAssociation(
    record: PluginDefaultPageContractBackfillAssociationRecord | undefined,
    canonicalKey: string,
    pageId: number | string,
  ): boolean {
    return Boolean(record) && record?.canonicalKey === canonicalKey && String(record.pageId) === String(pageId);
  }

  private createPersistSummary(
    entry: PluginDefaultPageContractMaterializationPlanEntry,
    pageId: number | string,
    persistResult: PluginDefaultPageContractAssociationPersistResult,
  ): PluginDefaultPageContractMaterializationExecutionEntrySummary {
    if (persistResult.status === 'applied') {
      return this.createEntrySummary(entry, 'applied', entry.reasons, pageId);
    }

    if (persistResult.status === 'noop') {
      return this.createEntrySummary(entry, 'noop', entry.reasons, pageId);
    }

    return this.createEntrySummary(
      entry,
      'failed',
      this.appendReason(entry.reasons, persistResult.reason || 'association-persist-conflict'),
      pageId,
    );
  }

  private createEntrySummary(
    entry: PluginDefaultPageContractMaterializationPlanEntry,
    executionOutcome: PluginDefaultPageContractMaterializationExecutionOutcome,
    reasons: string[],
    matchedPageId?: number | string,
  ): PluginDefaultPageContractMaterializationExecutionEntrySummary {
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
    entries: PluginDefaultPageContractMaterializationExecutionEntrySummary[],
  ): PluginDefaultPageContractMaterializationExecutionReportSummary {
    const summary: PluginDefaultPageContractMaterializationExecutionReportSummary = {
      total: entries.length,
      byOutcome: {
        applied: 0,
        failed: 0,
        noop: 0,
        skipped: 0,
      },
    };

    for (const entry of entries) {
      summary.byOutcome[entry.executionOutcome] += 1;
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