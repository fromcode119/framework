import type { IPluginDefaultPageContractBackfillPlan } from '@core/default-page-contract/interfaces/plugin-default-page-contract-backfill-plan.interface';
import type { IPluginDefaultPageContractBackfillPlanEntry } from '@core/default-page-contract/interfaces/plugin-default-page-contract-backfill-plan-entry.interface';
import type { IPluginDefaultPageContractBackfillPlanInput } from '@core/default-page-contract/interfaces/plugin-default-page-contract-backfill-plan-input.interface';
import type { IPluginDefaultPageContractBackfillPlanSummary } from '@core/default-page-contract/interfaces/plugin-default-page-contract-backfill-plan-summary.interface';
import { BaseService } from '@core/services/base-service';
import { PluginDefaultPageBackfillAssociationService } from '@core/services/default-page-contract/plugin-default-page-backfill-association-service';
import { PluginDefaultPageBackfillEntryFactory } from '@core/services/default-page-contract/plugin-default-page-backfill-entry-factory';
import { PluginDefaultPageBackfillMatchingService } from '@core/services/default-page-contract/plugin-default-page-backfill-matching-service';
import { SeedPageService } from '@core/services/seed-page-service';
import { PluginDefaultPageContractBackfillAction } from '@core/default-page-contract/enums/plugin-default-page-contract-backfill-action.enum';
import { PluginDefaultPageContractBackfillStatus } from '@core/default-page-contract/enums/plugin-default-page-contract-backfill-status.enum';

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

  createPlan(input: IPluginDefaultPageContractBackfillPlanInput): IPluginDefaultPageContractBackfillPlan {
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

  private createSummary(entries: IPluginDefaultPageContractBackfillPlanEntry[]): IPluginDefaultPageContractBackfillPlanSummary {
    const summary: IPluginDefaultPageContractBackfillPlanSummary = {
      total: entries.length,
      byAction: { 'already-associated': 0, ambiguous: 0, 'associate-existing': 0, blocked: 0, deferred: 0, skipped: 0 },
      byStatus: { 'already-associated': 0, ambiguous: 0, blocked: 0, deferred: 0, 'safe-to-associate': 0, skipped: 0 },
    };

    for (const entry of entries) {
      // Enum members can't index a Record; key the tallies by their bare `.value`.
      summary.byAction[entry.action.value] += 1;
      summary.byStatus[entry.status.value] += 1;
    }

    return summary;
  }

  private resolveClaimCollisions(entries: IPluginDefaultPageContractBackfillPlanEntry[]): IPluginDefaultPageContractBackfillPlanEntry[] {
    const pageClaims = new Map<string, number>();

    for (const entry of entries) {
      if (entry.action !== PluginDefaultPageContractBackfillAction.ASSOCIATE_EXISTING || entry.matchedPageId === undefined) {
        continue;
      }

      const claimKey = String(entry.matchedPageId);
      pageClaims.set(claimKey, (pageClaims.get(claimKey) || 0) + 1);
    }

    return entries.map((entry) => {
      if (entry.action !== PluginDefaultPageContractBackfillAction.ASSOCIATE_EXISTING || entry.matchedPageId === undefined) {
        return entry;
      }

      if ((pageClaims.get(String(entry.matchedPageId)) || 0) < 2) {
        return entry;
      }

      return {
        ...entry,
        action: PluginDefaultPageContractBackfillAction.AMBIGUOUS,
        status: PluginDefaultPageContractBackfillStatus.AMBIGUOUS,
        reasons: this.entryFactory.appendReason(entry.reasons, 'page-claimed-by-multiple-contracts'),
      };
    });
  }
}
