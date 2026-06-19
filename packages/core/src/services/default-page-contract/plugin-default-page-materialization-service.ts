import type {
  PluginDefaultPageContractMaterializationPlan,
  PluginDefaultPageContractMaterializationPlanEntry,
  PluginDefaultPageContractMaterializationPlanInput,
  PluginDefaultPageContractMaterializationPlanSummary,
} from '../../types';
import { BaseService } from '../base-service';
import { PluginDefaultPageMaterializationEntryFactory } from './plugin-default-page-materialization-entry-factory';
import { SeedPageService } from '../seed-page-service';

export class PluginDefaultPageMaterializationService extends BaseService {
  private readonly entryFactory: PluginDefaultPageMaterializationEntryFactory;

  constructor(seedPageService: SeedPageService) {
    super();
    this.entryFactory = new PluginDefaultPageMaterializationEntryFactory(seedPageService);
  }

  get serviceName(): string {
    return 'PluginDefaultPageMaterializationService';
  }

  createPlan(input: PluginDefaultPageContractMaterializationPlanInput): PluginDefaultPageContractMaterializationPlan {
    const pages = this.entryFactory.createCandidatePages(input.existingPages || []);
    const provisionalEntries = (input.resolvedContracts || [])
      .slice()
      .sort((left, right) => left.canonicalKey.localeCompare(right.canonicalKey))
      .map((contract) => this.entryFactory.createEntry(contract, pages));
    const entries = this.resolveClaimCollisions(provisionalEntries);

    return {
      entries,
      summary: this.createSummary(entries),
    };
  }

  private createSummary(entries: PluginDefaultPageContractMaterializationPlanEntry[]): PluginDefaultPageContractMaterializationPlanSummary {
    const summary: PluginDefaultPageContractMaterializationPlanSummary = {
      total: entries.length,
      byAction: {
        'adopt-existing': 0,
        ambiguous: 0,
        blocked: 0,
        'create-missing': 0,
        deferred: 0,
        skip: 0,
      },
      byStatus: {
        ambiguous: 0,
        blocked: 0,
        deferred: 0,
        ready: 0,
        skipped: 0,
      },
    };

    for (const entry of entries) {
      summary.byAction[entry.action] += 1;
      summary.byStatus[entry.status] += 1;
    }

    return summary;
  }

  private resolveClaimCollisions(
    entries: PluginDefaultPageContractMaterializationPlanEntry[],
  ): PluginDefaultPageContractMaterializationPlanEntry[] {
    const pageClaims = new Map<string, number>();

    for (const entry of entries) {
      if (entry.action !== 'adopt-existing' || entry.matchedPageId === undefined) {
        continue;
      }

      const claimKey = String(entry.matchedPageId);
      pageClaims.set(claimKey, (pageClaims.get(claimKey) || 0) + 1);
    }

    return entries.map((entry) => {
      if (entry.action !== 'adopt-existing' || entry.matchedPageId === undefined) {
        return entry;
      }

      if ((pageClaims.get(String(entry.matchedPageId)) || 0) < 2) {
        return entry;
      }

      return {
        ...entry,
        action: 'ambiguous',
        status: 'ambiguous',
        matchedPageId: undefined,
        createPayload: undefined,
        reasons: this.appendReason(entry.reasons, 'matched-page-claimed-by-multiple-contracts'),
      };
    });
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
