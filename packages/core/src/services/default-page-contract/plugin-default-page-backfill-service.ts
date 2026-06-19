import type {
  PluginDefaultPageContractBackfillPlan,
  PluginDefaultPageContractBackfillPlanEntry,
  PluginDefaultPageContractBackfillPlanInput,
  PluginDefaultPageContractBackfillPlanSummary,
} from '../../types';
import { BaseService } from '../base-service';
import { PluginDefaultPageBackfillAssociationService } from './plugin-default-page-backfill-association-service';
import { PluginDefaultPageBackfillEntryFactory } from './plugin-default-page-backfill-entry-factory';
import { PluginDefaultPageBackfillMatchingService } from './plugin-default-page-backfill-matching-service';
import { SeedPageService } from '../seed-page-service';

export class PluginDefaultPageBackfillService extends BaseService {
  private readonly associationService: PluginDefaultPageBackfillAssociationService;
  private readonly matchingService: PluginDefaultPageBackfillMatchingService;
  private readonly entryFactory: PluginDefaultPageBackfillEntryFactory;

  constructor(seedPageService: SeedPageService) {
    super();
    this.associationService = new PluginDefaultPageBackfillAssociationService();
    this.matchingService = new PluginDefaultPageBackfillMatchingService(seedPageService);
    this.entryFactory = new PluginDefaultPageBackfillEntryFactory(this.matchingService);
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
      .map((contract) => this.entryFactory.createEntry(contract, pages, associations));
    const entries = this.resolveClaimCollisions(provisionalEntries);

    return {
      entries,
      summary: this.createSummary(entries),
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
        reasons: this.entryFactory.appendReason(entry.reasons, 'page-claimed-by-multiple-contracts'),
      };
    });
  }
}
