import type { IPluginDefaultPageContractBackfillAssociationMaps } from '@core/default-page-contract/interfaces/plugin-default-page-contract-backfill-association-maps.interface';
import type { IPluginDefaultPageContractBackfillAssociationRecord } from '@core/default-page-contract/interfaces/plugin-default-page-contract-backfill-association-record.interface';
import type { IPluginDefaultPageContractBackfillPlanEntry } from '@core/default-page-contract/interfaces/plugin-default-page-contract-backfill-plan-entry.interface';
import type { IResolvedPluginDefaultPageContract } from '@core/default-page-contract/interfaces/resolved-plugin-default-page-contract.interface';
import { BaseService } from '@core/services/base-service';
import { PluginDefaultPageBackfillMatchingService } from '@core/services/default-page-contract/plugin-default-page-backfill-matching-service';
import { PluginDefaultPageContractBackfillAction } from '@core/default-page-contract/enums/plugin-default-page-contract-backfill-action.enum';
import { PluginDefaultPageContractBackfillStatus } from '@core/default-page-contract/enums/plugin-default-page-contract-backfill-status.enum';
import { PluginDefaultPageContractResolutionStatus } from '@core/default-page-contract/enums/plugin-default-page-contract-resolution-status.enum';
import { PluginDefaultPageContractMaterializationMode } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-mode.enum';

/** Builds a single backfill plan entry from a resolved contract plus candidate-page and
 * association maps. Extracted from PluginDefaultPageBackfillService; behavior is unchanged. */
export class PluginDefaultPageBackfillEntryFactory extends BaseService {
  constructor(private readonly matchingService: PluginDefaultPageBackfillMatchingService) {
    super();
  }

  get serviceName(): string {
    return 'PluginDefaultPageBackfillEntryFactory';
  }

  createEntry(
    contract: IResolvedPluginDefaultPageContract,
    pages: ReturnType<PluginDefaultPageBackfillMatchingService['createCandidatePages']>,
    associations: IPluginDefaultPageContractBackfillAssociationMaps,
  ): IPluginDefaultPageContractBackfillPlanEntry {
    const lookupCandidates = this.matchingService.buildLookupCandidates(contract);

    if (contract.status === PluginDefaultPageContractResolutionStatus.SKIPPED) {
      return this.createBaseEntry(contract, lookupCandidates, PluginDefaultPageContractBackfillAction.SKIPPED, PluginDefaultPageContractBackfillStatus.SKIPPED, undefined, undefined, contract.reasons);
    }

    if (contract.status === PluginDefaultPageContractResolutionStatus.BLOCKED) {
      return this.createBaseEntry(contract, lookupCandidates, PluginDefaultPageContractBackfillAction.BLOCKED, PluginDefaultPageContractBackfillStatus.BLOCKED, undefined, undefined, contract.reasons);
    }

    if (this.isRuntimeParameterizedContract(contract)) {
      return this.createBaseEntry(
        contract,
        lookupCandidates,
        PluginDefaultPageContractBackfillAction.DEFERRED,
        PluginDefaultPageContractBackfillStatus.DEFERRED,
        undefined,
        undefined,
        this.createReasons(contract.reasons, 'parameterized-route-deferred'),
      );
    }

    if (contract.materializationMode === PluginDefaultPageContractMaterializationMode.PER_RECORD_DOCUMENT) {
      return this.createBaseEntry(
        contract,
        lookupCandidates,
        PluginDefaultPageContractBackfillAction.DEFERRED,
        PluginDefaultPageContractBackfillStatus.DEFERRED,
        undefined,
        undefined,
        this.createReasons(contract.reasons, 'per-record-document-deferred'),
      );
    }

    const matches = this.matchingService.findMatches(lookupCandidates, pages);
    const existingAssociation = associations.byCanonicalKey.get(contract.canonicalKey);

    if (existingAssociation) {
      return this.createAssociatedEntry(contract, lookupCandidates, matches, pages, associations, existingAssociation);
    }

    if (matches.length > 1) {
      return this.createBaseEntry(
        contract,
        lookupCandidates,
        PluginDefaultPageContractBackfillAction.AMBIGUOUS,
        PluginDefaultPageContractBackfillStatus.AMBIGUOUS,
        undefined,
        undefined,
        this.createReasons(contract.reasons, 'multiple-existing-pages-matched'),
      );
    }

    if (matches.length === 1) {
      const match = matches[0];

      if (this.hasAssociationConflict(associations, contract.canonicalKey, match.matchedPageId)) {
        return this.createBaseEntry(
          contract,
          lookupCandidates,
          PluginDefaultPageContractBackfillAction.AMBIGUOUS,
          PluginDefaultPageContractBackfillStatus.AMBIGUOUS,
          match.matchedPageId,
          undefined,
          this.createSnapshotConflictReasons(contract.reasons, match.source.value),
        );
      }

      const pageAssociation = associations.byPageId.get(String(match.matchedPageId));

      if (pageAssociation && pageAssociation.canonicalKey !== contract.canonicalKey) {
        return this.createBaseEntry(
          contract,
          lookupCandidates,
          PluginDefaultPageContractBackfillAction.AMBIGUOUS,
          PluginDefaultPageContractBackfillStatus.AMBIGUOUS,
          match.matchedPageId,
          undefined,
          this.appendReason(
            this.appendReason(contract.reasons, `matched-by-${match.source}`),
            'matched-page-already-associated-to-different-contract',
          ),
        );
      }

      return this.createBaseEntry(
        contract,
        lookupCandidates,
        PluginDefaultPageContractBackfillAction.ASSOCIATE_EXISTING,
        PluginDefaultPageContractBackfillStatus.SAFE_TO_ASSOCIATE,
        match.matchedPageId,
        undefined,
        this.createReasons(contract.reasons, `matched-by-${match.source}`),
      );
    }

    return this.createBaseEntry(
      contract,
      lookupCandidates,
      PluginDefaultPageContractBackfillAction.BLOCKED,
      PluginDefaultPageContractBackfillStatus.BLOCKED,
      undefined,
      undefined,
      this.createReasons(contract.reasons, contract.materializationMode === PluginDefaultPageContractMaterializationMode.ADOPT_ONLY ? 'adopt-only-no-match' : 'no-existing-page-match'),
    );
  }

  private createAssociatedEntry(
    contract: IResolvedPluginDefaultPageContract,
    lookupCandidates: string[],
    matches: ReturnType<PluginDefaultPageBackfillMatchingService['findMatches']>,
    pages: ReturnType<PluginDefaultPageBackfillMatchingService['createCandidatePages']>,
    associations: IPluginDefaultPageContractBackfillAssociationMaps,
    existingAssociation: IPluginDefaultPageContractBackfillAssociationRecord,
  ): IPluginDefaultPageContractBackfillPlanEntry {
    const associatedPageId = existingAssociation.pageId;
    const associatedPageExists = pages.some((page) => this.isSameIdentifier(page.id, associatedPageId));
    const matchingAssociatedPage = matches.find((match) => this.isSameIdentifier(match.matchedPageId, associatedPageId));

    if (this.hasAssociationConflict(associations, contract.canonicalKey, associatedPageId)) {
      return this.createBaseEntry(
        contract,
        lookupCandidates,
        PluginDefaultPageContractBackfillAction.AMBIGUOUS,
        PluginDefaultPageContractBackfillStatus.AMBIGUOUS,
        matches.length === 1 ? matches[0]?.matchedPageId : undefined,
        associatedPageId,
        this.createSnapshotConflictReasons(contract.reasons, matches.length === 1 ? matches[0]?.source?.value : undefined),
      );
    }

    if (matchingAssociatedPage || (associatedPageExists && matches.length === 0)) {
      return this.createBaseEntry(
        contract,
        lookupCandidates,
        PluginDefaultPageContractBackfillAction.ALREADY_ASSOCIATED,
        PluginDefaultPageContractBackfillStatus.ALREADY_ASSOCIATED,
        undefined,
        associatedPageId,
        this.createReasons(contract.reasons, 'already-associated'),
      );
    }

    if (!associatedPageExists && matches.length === 0) {
      return this.createBaseEntry(
        contract,
        lookupCandidates,
        PluginDefaultPageContractBackfillAction.BLOCKED,
        PluginDefaultPageContractBackfillStatus.BLOCKED,
        undefined,
        associatedPageId,
        this.createReasons(this.appendReason(contract.reasons, 'associated-page-missing-from-snapshot'), 'associated-page-missing-from-snapshot'),
      );
    }

    const conflictReasons = this.appendReason(contract.reasons, 'contract-already-associated-to-different-page');
    const reasonsWithSnapshot = associatedPageExists
      ? conflictReasons
      : this.appendReason(conflictReasons, 'associated-page-missing-from-snapshot');

    if (matches.length > 1) {
      return this.createBaseEntry(
        contract,
        lookupCandidates,
        PluginDefaultPageContractBackfillAction.AMBIGUOUS,
        PluginDefaultPageContractBackfillStatus.AMBIGUOUS,
        undefined,
        associatedPageId,
        this.createReasons(this.appendReason(reasonsWithSnapshot, 'multiple-existing-pages-matched'), 'multiple-existing-pages-matched'),
      );
    }

    return this.createBaseEntry(
      contract,
      lookupCandidates,
      PluginDefaultPageContractBackfillAction.AMBIGUOUS,
      PluginDefaultPageContractBackfillStatus.AMBIGUOUS,
      matches[0]?.matchedPageId,
      associatedPageId,
      this.createReasons(
        this.appendReason(reasonsWithSnapshot, `matched-by-${matches[0].source}`),
        'contract-already-associated-to-different-page',
      ),
    );
  }

  private createBaseEntry(
    contract: IResolvedPluginDefaultPageContract,
    lookupCandidates: string[],
    action: IPluginDefaultPageContractBackfillPlanEntry['action'],
    status: IPluginDefaultPageContractBackfillPlanEntry['status'],
    matchedPageId?: IPluginDefaultPageContractBackfillPlanEntry['matchedPageId'],
    existingAssociationPageId?: IPluginDefaultPageContractBackfillPlanEntry['existingAssociationPageId'],
    reasons?: string[],
  ): IPluginDefaultPageContractBackfillPlanEntry {
    return {
      canonicalKey: contract.canonicalKey,
      namespace: contract.namespace,
      pluginSlug: contract.pluginSlug,
      key: contract.key,
      action,
      status,
      matchedPageId,
      existingAssociationPageId,
      lookupCandidates: [...lookupCandidates],
      reasons: [...(reasons || [])],
      materializationMode: contract.materializationMode,
    };
  }

  private createReasons(existingReasons: string[], fallbackReason: string): string[] {
    const normalized = Array.from(
      new Set(
        (existingReasons || [])
          .map((reason) => String(reason || '').trim())
          .filter(Boolean),
      ),
    );

    if (normalized.length) {
      return normalized;
    }

    return [fallbackReason];
  }

  appendReason(existingReasons: string[], nextReason: string): string[] {
    return Array.from(
      new Set(
        [...(existingReasons || []), nextReason]
          .map((reason) => String(reason || '').trim())
          .filter(Boolean),
      ),
    );
  }

  private createSnapshotConflictReasons(existingReasons: string[], matchSource?: string): string[] {
    const reasons = matchSource
      ? this.appendReason(existingReasons, `matched-by-${matchSource}`)
      : [...(existingReasons || [])];

    return this.createReasons(this.appendReason(reasons, 'conflicting-association-snapshot'), 'conflicting-association-snapshot');
  }

  private hasAssociationConflict(
    associations: IPluginDefaultPageContractBackfillAssociationMaps,
    canonicalKey: string,
    pageId?: number | string,
  ): boolean {
    if (associations.conflicts.canonicalKeys.has(canonicalKey)) {
      return true;
    }

    return pageId !== undefined && associations.conflicts.pageIds.has(String(pageId));
  }

  private isSameIdentifier(left: number | string | undefined, right: number | string | undefined): boolean {
    return left !== undefined && right !== undefined && String(left) === String(right);
  }

  private isRuntimeParameterizedContract(contract: IResolvedPluginDefaultPageContract): boolean {
    return contract.materializationMode === PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT && this.hasPathParameters(contract.effectiveSlug);
  }

  private hasPathParameters(value: string): boolean {
    return String(value || '')
      .trim()
      .split('?')[0]
      .split('#')[0]
      .split('/')
      .filter(Boolean)
      .some((segment) => segment.startsWith(':'));
  }
}
