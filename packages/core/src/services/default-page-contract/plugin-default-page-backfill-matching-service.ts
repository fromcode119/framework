import type {
  PluginDefaultPageContractBackfillCandidatePage,
  PluginDefaultPageContractBackfillPageMatch,
  PluginDefaultPageContractBackfillPlanInput,
  ResolvedPluginDefaultPageContract,
} from '../../types';
import { BaseService } from '../base-service';
import { SeedPageService } from '../seed-page-service';

export class PluginDefaultPageBackfillMatchingService extends BaseService {
  constructor(private readonly seedPageService: SeedPageService) {
    super();
  }

  get serviceName(): string {
    return 'PluginDefaultPageBackfillMatchingService';
  }

  createCandidatePages(
    existingPages: PluginDefaultPageContractBackfillPlanInput['existingPages'],
  ): PluginDefaultPageContractBackfillCandidatePage[] {
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

  buildLookupCandidates(contract: ResolvedPluginDefaultPageContract): string[] {
    const baseCandidates = [...contract.effectiveAliases, ...contract.adoptionHints];

    return this.seedPageService.buildPageLookupCandidates(baseCandidates, {
      customPermalink: contract.effectiveSlug,
      slug: contract.effectiveSlug,
    });
  }

  findMatches(
    lookupCandidates: string[],
    pages: PluginDefaultPageContractBackfillCandidatePage[],
  ): PluginDefaultPageContractBackfillPageMatch[] {
    const allMatches = pages
      .map((page) => this.getPageMatch(page, lookupCandidates))
      .filter((match): match is PluginDefaultPageContractBackfillPageMatch => Boolean(match));

    if (!allMatches.length) {
      return [];
    }

    const bestPriority = Math.min(...allMatches.map((match) => match.priority));

    return allMatches
      .filter((match) => match.priority === bestPriority)
      .sort((left, right) => String(left.matchedPageId).localeCompare(String(right.matchedPageId)));
  }

  private getPageMatch(
    page: PluginDefaultPageContractBackfillCandidatePage,
    lookupCandidates: string[],
  ): PluginDefaultPageContractBackfillPageMatch | undefined {
    if (this.hasCandidateMatch(lookupCandidates, page.customPermalinkCandidates)) {
      return {
        matchedPageId: page.id,
        priority: 0,
        source: 'customPermalink',
      };
    }

    if (this.hasCandidateMatch(lookupCandidates, page.slugCandidates)) {
      return {
        matchedPageId: page.id,
        priority: 1,
        source: 'slug',
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