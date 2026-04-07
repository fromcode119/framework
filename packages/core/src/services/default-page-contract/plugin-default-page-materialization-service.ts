import type {
  PluginDefaultPageContractCreatePayload,
  PluginDefaultPageContractMaterializationCandidatePage,
  PluginDefaultPageContractMaterializationPageMatch,
  PluginDefaultPageContractMaterializationPlan,
  PluginDefaultPageContractMaterializationPlanEntry,
  PluginDefaultPageContractMaterializationPlanInput,
  PluginDefaultPageContractMaterializationPlanSummary,
  ResolvedPluginDefaultPageContract,
} from '../../types';
import { BaseService } from '../base-service';
import { SeedPageService } from '../seed-page-service';

export class PluginDefaultPageMaterializationService extends BaseService {
  constructor(private readonly seedPageService: SeedPageService) {
    super();
  }

  get serviceName(): string {
    return 'PluginDefaultPageMaterializationService';
  }

  createPlan(input: PluginDefaultPageContractMaterializationPlanInput): PluginDefaultPageContractMaterializationPlan {
    const pages = this.createCandidatePages(input.existingPages || []);
    const provisionalEntries = (input.resolvedContracts || [])
      .slice()
      .sort((left, right) => left.canonicalKey.localeCompare(right.canonicalKey))
      .map((contract) => this.createEntry(contract, pages));
    const entries = this.resolveClaimCollisions(provisionalEntries);

    return {
      entries,
      summary: this.createSummary(entries),
    };
  }

  private createCandidatePages(existingPages: PluginDefaultPageContractMaterializationPlanInput['existingPages']): PluginDefaultPageContractMaterializationCandidatePage[] {
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

  private createEntry(
    contract: ResolvedPluginDefaultPageContract,
    pages: PluginDefaultPageContractMaterializationCandidatePage[],
  ): PluginDefaultPageContractMaterializationPlanEntry {
    const lookupCandidates = this.buildLookupCandidates(contract);

    if (contract.status === 'skipped') {
      return this.createBaseEntry(contract, lookupCandidates, 'skip', 'skipped', undefined, undefined, contract.reasons);
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

    const matches = this.findMatches(lookupCandidates, pages);

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
      return this.createBaseEntry(
        contract,
        lookupCandidates,
        'adopt-existing',
        'ready',
        matches[0].matchedPageId,
        undefined,
        this.createReasons(contract.reasons, `matched-by-${matches[0].source}`),
      );
    }

    if (contract.materializationMode === 'adopt-only') {
      return this.createBaseEntry(
        contract,
        lookupCandidates,
        'blocked',
        'blocked',
        undefined,
        undefined,
        this.createReasons(contract.reasons, 'adopt-only-no-match'),
      );
    }

    return this.createBaseEntry(
      contract,
      lookupCandidates,
      'create-missing',
      'ready',
      undefined,
      this.createCreatePayload(contract),
      this.createReasons(contract.reasons, 'no-existing-page-match'),
    );
  }

  private buildLookupCandidates(contract: ResolvedPluginDefaultPageContract): string[] {
    const baseCandidates = [...contract.effectiveAliases, ...contract.adoptionHints];

    return this.seedPageService.buildPageLookupCandidates(baseCandidates, {
      customPermalink: contract.effectiveSlug,
      slug: contract.effectiveSlug,
    });
  }

  private findMatches(
    lookupCandidates: string[],
    pages: PluginDefaultPageContractMaterializationCandidatePage[],
  ): PluginDefaultPageContractMaterializationPageMatch[] {
    const allMatches = pages
      .map((page) => this.getPageMatch(page, lookupCandidates))
      .filter((match): match is PluginDefaultPageContractMaterializationPageMatch => Boolean(match));

    if (!allMatches.length) {
      return [];
    }

    const bestPriority = Math.min(...allMatches.map((match) => match.priority));

    return allMatches
      .filter((match) => match.priority === bestPriority)
      .sort((left, right) => String(left.matchedPageId).localeCompare(String(right.matchedPageId)));
  }

  private getPageMatch(
    page: PluginDefaultPageContractMaterializationCandidatePage,
    lookupCandidates: string[],
  ): PluginDefaultPageContractMaterializationPageMatch | undefined {
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

  private createCreatePayload(contract: ResolvedPluginDefaultPageContract): PluginDefaultPageContractCreatePayload {
    return {
      canonicalKey: contract.canonicalKey,
      namespace: contract.namespace,
      pluginSlug: contract.pluginSlug,
      key: contract.key,
      slug: contract.effectiveSlug,
      customPermalink: contract.effectiveSlug,
      aliases: [...contract.effectiveAliases],
      recipe: contract.effectiveRecipe,
      title: contract.effectiveTitle,
      themeLayout: contract.effectiveThemeLayout,
    };
  }

  private createBaseEntry(
    contract: ResolvedPluginDefaultPageContract,
    lookupCandidates: string[],
    action: PluginDefaultPageContractMaterializationPlanEntry['action'],
    status: PluginDefaultPageContractMaterializationPlanEntry['status'],
    matchedPageId?: PluginDefaultPageContractMaterializationPlanEntry['matchedPageId'],
    createPayload?: PluginDefaultPageContractMaterializationPlanEntry['createPayload'],
    reasons?: string[],
  ): PluginDefaultPageContractMaterializationPlanEntry {
    return {
      canonicalKey: contract.canonicalKey,
      namespace: contract.namespace,
      pluginSlug: contract.pluginSlug,
      key: contract.key,
      action,
      lookupCandidates: [...lookupCandidates],
      matchedPageId,
      createPayload: createPayload
        ? {
            ...createPayload,
            aliases: [...createPayload.aliases],
          }
        : undefined,
      reasons: [...(reasons || [])],
      materializationMode: contract.materializationMode,
      status,
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

  private normalizeOptionalString(value?: string): string | undefined {
    const normalized = String(value || '').trim();
    return normalized || undefined;
  }
}