import type { IPluginDefaultPageContractMaterializationPlan } from '@core/default-page-contract/interfaces/plugin-default-page-contract-materialization-plan.interface';
import type { IPluginDefaultPageContractMaterializationPlanEntry } from '@core/default-page-contract/interfaces/plugin-default-page-contract-materialization-plan-entry.interface';
import type { IPluginDefaultPageContractMaterializationPlanInput } from '@core/default-page-contract/interfaces/plugin-default-page-contract-materialization-plan-input.interface';
import type { IPluginDefaultPageContractMaterializationPlanSummary } from '@core/default-page-contract/interfaces/plugin-default-page-contract-materialization-plan-summary.interface';
import { BaseService } from '@core/services/base-service';
import { PluginDefaultPageMaterializationEntryFactory } from '@core/services/default-page-contract/plugin-default-page-materialization-entry-factory';
import { SeedPageService } from '@core/services/seed-page-service';
import { PluginDefaultPageContractMaterializationAction } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-action.enum';
import { PluginDefaultPageContractMaterializationStatus } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-status.enum';

export class PluginDefaultPageMaterializationService extends BaseService {
  private readonly entryFactory: PluginDefaultPageMaterializationEntryFactory;

  constructor(seedPageService: SeedPageService) {
    super();
    this.entryFactory = new PluginDefaultPageMaterializationEntryFactory(seedPageService);
  }

  get serviceName(): string {
    return 'PluginDefaultPageMaterializationService';
  }

  createPlan(input: IPluginDefaultPageContractMaterializationPlanInput): IPluginDefaultPageContractMaterializationPlan {
    const pages = this.entryFactory.createCandidatePages(input.existingPages || []);
    const provisionalEntries = (input.resolvedContracts || [])
      .slice()
      .sort((left, right) => left.canonicalKey.localeCompare(right.canonicalKey))
      .map((contract) => this.entryFactory.createEntry(contract, pages));
    const entries = this.resolveCreateCollisions(this.resolveClaimCollisions(provisionalEntries));

    return {
      entries,
      summary: this.createSummary(entries),
    };
  }

  private createSummary(entries: IPluginDefaultPageContractMaterializationPlanEntry[]): IPluginDefaultPageContractMaterializationPlanSummary {
    const summary: IPluginDefaultPageContractMaterializationPlanSummary = {
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
      summary.byAction[entry.action.value] += 1;
      summary.byStatus[entry.status.value] += 1;
    }

    return summary;
  }

  private resolveClaimCollisions(
    entries: IPluginDefaultPageContractMaterializationPlanEntry[],
  ): IPluginDefaultPageContractMaterializationPlanEntry[] {
    const pageClaims = new Map<string, number>();

    for (const entry of entries) {
      if (entry.action !== PluginDefaultPageContractMaterializationAction.ADOPT_EXISTING || entry.matchedPageId === undefined) {
        continue;
      }

      const claimKey = String(entry.matchedPageId);
      pageClaims.set(claimKey, (pageClaims.get(claimKey) || 0) + 1);
    }

    return entries.map((entry) => {
      if (entry.action !== PluginDefaultPageContractMaterializationAction.ADOPT_EXISTING || entry.matchedPageId === undefined) {
        return entry;
      }

      if ((pageClaims.get(String(entry.matchedPageId)) || 0) < 2) {
        return entry;
      }

      return {
        ...entry,
        action: PluginDefaultPageContractMaterializationAction.AMBIGUOUS,
        status: PluginDefaultPageContractMaterializationStatus.AMBIGUOUS,
        matchedPageId: undefined,
        createPayload: undefined,
        reasons: this.appendReason(entry.reasons, 'matched-page-claimed-by-multiple-contracts'),
      };
    });
  }

  /**
   * Two contracts planning a NEW page on one custom permalink is a conflict, not a race to insert.
   *
   * {@link resolveClaimCollisions} above only covers contracts adopting the same EXISTING page. When no
   * page exists yet, both entries are CREATE_MISSING and each is individually valid, so the executor
   * would create the first page and then a second one on the same permalink — two pages the router
   * cannot tell apart, and an association snapshot that can only point at one of them. Fail both
   * closed instead and name the collision; whichever contract should own the route says so by not
   * colliding.
   */
  private resolveCreateCollisions(
    entries: IPluginDefaultPageContractMaterializationPlanEntry[],
  ): IPluginDefaultPageContractMaterializationPlanEntry[] {
    const permalinkClaims = new Map<string, number>();

    for (const entry of entries) {
      const claimKey = this.getCreatePermalinkClaimKey(entry);
      if (!claimKey) {
        continue;
      }

      permalinkClaims.set(claimKey, (permalinkClaims.get(claimKey) || 0) + 1);
    }

    return entries.map((entry) => {
      const claimKey = this.getCreatePermalinkClaimKey(entry);
      if (!claimKey || (permalinkClaims.get(claimKey) || 0) < 2) {
        return entry;
      }

      return {
        ...entry,
        action: PluginDefaultPageContractMaterializationAction.AMBIGUOUS,
        status: PluginDefaultPageContractMaterializationStatus.AMBIGUOUS,
        matchedPageId: undefined,
        createPayload: undefined,
        reasons: this.appendReason(entry.reasons, 'custom-permalink-claimed-by-multiple-contracts'),
      };
    });
  }

  private getCreatePermalinkClaimKey(entry: IPluginDefaultPageContractMaterializationPlanEntry): string {
    if (entry.action !== PluginDefaultPageContractMaterializationAction.CREATE_MISSING || !entry.createPayload) {
      return '';
    }

    return String(entry.createPayload.customPermalink || '')
      .trim()
      .replace(/\/+$/, '')
      .toLowerCase();
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
