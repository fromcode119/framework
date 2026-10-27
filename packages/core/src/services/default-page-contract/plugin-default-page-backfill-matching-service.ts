import type { IPluginDefaultPageContractBackfillCandidatePage } from '@core/default-page-contract/interfaces/plugin-default-page-contract-backfill-candidate-page.interface';
import type { IPluginDefaultPageContractBackfillPageMatch } from '@core/default-page-contract/interfaces/plugin-default-page-contract-backfill-page-match.interface';
import type { IPluginDefaultPageContractBackfillPlanInput } from '@core/default-page-contract/interfaces/plugin-default-page-contract-backfill-plan-input.interface';
import type { IResolvedPluginDefaultPageContract } from '@core/default-page-contract/interfaces/resolved-plugin-default-page-contract.interface';
import { BaseService } from '@core/services/base-service';
import { SeedPageService } from '@core/services/seed-page-service';
import { PluginDefaultPageContractBackfillMatchSource } from '@core/default-page-contract/enums/plugin-default-page-contract-backfill-match-source.enum';

export class PluginDefaultPageBackfillMatchingService extends BaseService {
  constructor(private readonly seedPageService: SeedPageService) {
    super();
  }

  get serviceName(): string {
    return 'PluginDefaultPageBackfillMatchingService';
  }

  createCandidatePages(
    existingPages: IPluginDefaultPageContractBackfillPlanInput['existingPages'],
  ): IPluginDefaultPageContractBackfillCandidatePage[] {
    return existingPages.map((page) => {
      return {
        id: page.id,
        slug: this.normalizeOptionalString(page.slug),
        customPermalink: this.normalizeOptionalString(page.customPermalink),
        title: this.normalizeOptionalString(page.title),
        status: this.normalizeOptionalString(page.status),
        customPermalinkCandidates: this.seedPageService.buildPageLookupCandidates([], {
          customPermalink: page.customPermalink,
        }),
        slugCandidates: this.seedPageService.buildPageLookupCandidates([], {
          slug: page.slug,
        }),
      };
    });
  }

  buildLookupCandidates(contract: IResolvedPluginDefaultPageContract): string[] {
    const baseCandidates = [...contract.effectiveAliases, ...contract.adoptionHints];

    return this.seedPageService.buildPageLookupCandidates(baseCandidates, {
      customPermalink: contract.effectiveSlug,
      slug: contract.effectiveSlug,
    });
  }

  /** The contract's own route, without aliases and hints — see {@link findMatches}. */
  buildPrimaryCandidates(contract: IResolvedPluginDefaultPageContract): string[] {
    return this.seedPageService.buildPageLookupCandidates([], {
      customPermalink: contract.effectiveSlug,
      slug: contract.effectiveSlug,
    });
  }

  /**
   * A page on the contract's own route outranks a page that only sits on one of its aliases: a site
   * can give an alias route a landing page of its own, and ranking the two level reports the contract
   * ambiguous although the page on its route is plainly the one.
   */
  findMatches(
    lookupCandidates: string[],
    primaryCandidates: string[],
    pages: IPluginDefaultPageContractBackfillCandidatePage[],
  ): IPluginDefaultPageContractBackfillPageMatch[] {
    const allMatches = pages
      .map((page) => this.getPageMatch(page, primaryCandidates, 0) || this.getPageMatch(page, lookupCandidates, 2))
      .filter((match): match is IPluginDefaultPageContractBackfillPageMatch => Boolean(match));

    if (!allMatches.length) {
      return [];
    }

    const bestPriority = Math.min(...allMatches.map((match) => match.priority));

    return allMatches
      .filter((match) => match.priority === bestPriority)
      .sort((left, right) => String(left.matchedPageId).localeCompare(String(right.matchedPageId)));
  }

  private getPageMatch(
    page: IPluginDefaultPageContractBackfillCandidatePage,
    lookupCandidates: string[],
    basePriority: number,
  ): IPluginDefaultPageContractBackfillPageMatch | undefined {
    if (this.hasCandidateMatch(lookupCandidates, page.customPermalinkCandidates)) {
      return {
        matchedPageId: page.id,
        priority: basePriority,
        source: PluginDefaultPageContractBackfillMatchSource.CUSTOM_PERMALINK,
      };
    }

    if (this.hasCandidateMatch(lookupCandidates, page.slugCandidates)) {
      return {
        matchedPageId: page.id,
        priority: basePriority + 1,
        source: PluginDefaultPageContractBackfillMatchSource.SLUG,
      };
    }

    return undefined;
  }

  private hasCandidateMatch(lookupCandidates: string[], pageCandidates: string[]): boolean {
    return pageCandidates.some((candidate) => lookupCandidates.includes(candidate));
  }

  private normalizeOptionalString(value?: string): string | undefined {
    const normalized = String(value || '').trim();
    return normalized || undefined;
  }
}