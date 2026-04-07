import type {
  PluginDefaultPageContractBackfillAssociationMaps,
  PluginDefaultPageContractBackfillAssociationRecord,
  PluginDefaultPageContractBackfillPlan,
  PluginDefaultPageContractBackfillPlanEntry,
  PluginDefaultPageContractBackfillPlanInput,
  PluginDefaultPageContractBackfillPlanSummary,
  ResolvedPluginDefaultPageContract,
} from '../../types';
import { BaseService } from '../base-service';
import { PluginDefaultPageBackfillAssociationService } from './plugin-default-page-backfill-association-service';
import { PluginDefaultPageBackfillMatchingService } from './plugin-default-page-backfill-matching-service';
import { SeedPageService } from '../seed-page-service';

export class PluginDefaultPageBackfillService extends BaseService {
  private readonly associationService: PluginDefaultPageBackfillAssociationService;
  private readonly matchingService: PluginDefaultPageBackfillMatchingService;

  constructor(seedPageService: SeedPageService) {
    super();
    this.associationService = new PluginDefaultPageBackfillAssociationService();
    this.matchingService = new PluginDefaultPageBackfillMatchingService(seedPageService);
  }

  get serviceName(): string {
    return 'PluginDefaultPageBackfillService';
  }

  createPlan(input: PluginDefaultPageContractBackfillPlanInput): PluginDefaultPageContractBackfillPlan {
    const pages = this.matchingService.createCandidatePages(input.existingPages || []);
    const associations = this.associationService.createMaps(input.existingAssociations);
    const provisionalEntries = (input.resolvedContracts || [])
      .slice()
      .sort((left, right) => left.canonicalKey.localeCompare(right.canonicalKey))
      .map((contract) => this.createEntry(contract, pages, associations));
    const entries = this.resolveClaimCollisions(provisionalEntries);

    return {
      entries,
      summary: this.createSummary(entries),
    };
  }

  private createEntry(
    contract: ResolvedPluginDefaultPageContract,
    pages: ReturnType<PluginDefaultPageBackfillMatchingService['createCandidatePages']>,
    associations: PluginDefaultPageContractBackfillAssociationMaps,
  ): PluginDefaultPageContractBackfillPlanEntry {
    const lookupCandidates = this.matchingService.buildLookupCandidates(contract);

    if (contract.status === 'skipped') {
      return this.createBaseEntry(contract, lookupCandidates, 'skipped', 'skipped', undefined, undefined, contract.reasons);
    }

    if (contract.status === 'blocked') {
      return this.createBaseEntry(contract, lookupCandidates, 'blocked', 'blocked', undefined, undefined, contract.reasons);
    }

    if (contract.materializationMode === 'per-record-document') {
      return this.createBaseEntry(
        contract,
        lookupCandidates,
        'deferred',
        'deferred',
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
        'ambiguous',
        'ambiguous',
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
          'ambiguous',
          'ambiguous',
          match.matchedPageId,
          undefined,
          this.createSnapshotConflictReasons(contract.reasons, match.source),
        );
      }

      const pageAssociation = associations.byPageId.get(String(match.matchedPageId));

      if (pageAssociation && pageAssociation.canonicalKey !== contract.canonicalKey) {
        return this.createBaseEntry(
          contract,
          lookupCandidates,
          'ambiguous',
          'ambiguous',
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
        'associate-existing',
        'safe-to-associate',
        match.matchedPageId,
        undefined,
        this.createReasons(contract.reasons, `matched-by-${match.source}`),
      );
    }

    return this.createBaseEntry(
      contract,
      lookupCandidates,
      'blocked',
      'blocked',
      undefined,
      undefined,
      this.createReasons(contract.reasons, contract.materializationMode === 'adopt-only' ? 'adopt-only-no-match' : 'no-existing-page-match'),
    );
  }

  private createAssociatedEntry(
    contract: ResolvedPluginDefaultPageContract,
    lookupCandidates: string[],
    matches: ReturnType<PluginDefaultPageBackfillMatchingService['findMatches']>,
    pages: ReturnType<PluginDefaultPageBackfillMatchingService['createCandidatePages']>,
    associations: PluginDefaultPageContractBackfillAssociationMaps,
    existingAssociation: PluginDefaultPageContractBackfillAssociationRecord,
  ): PluginDefaultPageContractBackfillPlanEntry {
    const associatedPageId = existingAssociation.pageId;
    const associatedPageExists = pages.some((page) => this.isSameIdentifier(page.id, associatedPageId));
    const matchingAssociatedPage = matches.find((match) => this.isSameIdentifier(match.matchedPageId, associatedPageId));

    if (this.hasAssociationConflict(associations, contract.canonicalKey, associatedPageId)) {
      return this.createBaseEntry(
        contract,
        lookupCandidates,
        'ambiguous',
        'ambiguous',
        matches.length === 1 ? matches[0]?.matchedPageId : undefined,
        associatedPageId,
        this.createSnapshotConflictReasons(contract.reasons, matches.length === 1 ? matches[0]?.source : undefined),
      );
    }

    if (matchingAssociatedPage || (associatedPageExists && matches.length === 0)) {
      return this.createBaseEntry(
        contract,
        lookupCandidates,
        'already-associated',
        'already-associated',
        undefined,
        associatedPageId,
        this.createReasons(contract.reasons, 'already-associated'),
      );
    }

    if (!associatedPageExists && matches.length === 0) {
      return this.createBaseEntry(
        contract,
        lookupCandidates,
        'blocked',
        'blocked',
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
        'ambiguous',
        'ambiguous',
        undefined,
        associatedPageId,
        this.createReasons(this.appendReason(reasonsWithSnapshot, 'multiple-existing-pages-matched'), 'multiple-existing-pages-matched'),
      );
    }

    return this.createBaseEntry(
      contract,
      lookupCandidates,
      'ambiguous',
      'ambiguous',
      matches[0]?.matchedPageId,
      associatedPageId,
      this.createReasons(
        this.appendReason(reasonsWithSnapshot, `matched-by-${matches[0].source}`),
        'contract-already-associated-to-different-page',
      ),
    );
  }

  private createBaseEntry(
    contract: ResolvedPluginDefaultPageContract,
    lookupCandidates: string[],
    action: PluginDefaultPageContractBackfillPlanEntry['action'],
    status: PluginDefaultPageContractBackfillPlanEntry['status'],
    matchedPageId?: PluginDefaultPageContractBackfillPlanEntry['matchedPageId'],
    existingAssociationPageId?: PluginDefaultPageContractBackfillPlanEntry['existingAssociationPageId'],
    reasons?: string[],
  ): PluginDefaultPageContractBackfillPlanEntry {
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

  private createSummary(entries: PluginDefaultPageContractBackfillPlanEntry[]): PluginDefaultPageContractBackfillPlanSummary {
    const summary: PluginDefaultPageContractBackfillPlanSummary = {
      total: entries.length,
      byAction: { 'already-associated': 0, ambiguous: 0, 'associate-existing': 0, blocked: 0, deferred: 0, skipped: 0 },
      byStatus: { 'already-associated': 0, ambiguous: 0, blocked: 0, deferred: 0, 'safe-to-associate': 0, skipped: 0 },
    };

    for (const entry of entries) {
      summary.byAction[entry.action] += 1;
      summary.byStatus[entry.status] += 1;
    }

    return summary;
  }

  private resolveClaimCollisions(entries: PluginDefaultPageContractBackfillPlanEntry[]): PluginDefaultPageContractBackfillPlanEntry[] {
    const pageClaims = new Map<string, number>();

    for (const entry of entries) {
      if (entry.action !== 'associate-existing' || entry.matchedPageId === undefined) {
        continue;
      }

      const claimKey = String(entry.matchedPageId);
      pageClaims.set(claimKey, (pageClaims.get(claimKey) || 0) + 1);
    }

    return entries.map((entry) => {
      if (entry.action !== 'associate-existing' || entry.matchedPageId === undefined) {
        return entry;
      }

      if ((pageClaims.get(String(entry.matchedPageId)) || 0) < 2) {
        return entry;
      }

      return {
        ...entry,
        action: 'ambiguous',
        status: 'ambiguous',
        reasons: this.appendReason(entry.reasons, 'page-claimed-by-multiple-contracts'),
      };
    });
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

  private appendReason(existingReasons: string[], nextReason: string): string[] {
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
    associations: PluginDefaultPageContractBackfillAssociationMaps,
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
}