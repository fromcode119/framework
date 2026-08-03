import type { IPluginDefaultPageContractCreatePayload } from '@core/default-page-contract/interfaces/plugin-default-page-contract-create-payload.interface';
import type { IPluginDefaultPageContractMaterializationCandidatePage } from '@core/default-page-contract/interfaces/plugin-default-page-contract-materialization-candidate-page.interface';
import type { IPluginDefaultPageContractMaterializationPageMatch } from '@core/default-page-contract/interfaces/plugin-default-page-contract-materialization-page-match.interface';
import type { IPluginDefaultPageContractMaterializationPlanEntry } from '@core/default-page-contract/interfaces/plugin-default-page-contract-materialization-plan-entry.interface';
import type { IPluginDefaultPageContractMaterializationPlanInput } from '@core/default-page-contract/interfaces/plugin-default-page-contract-materialization-plan-input.interface';
import type { IResolvedPluginDefaultPageContract } from '@core/default-page-contract/interfaces/resolved-plugin-default-page-contract.interface';
import { BaseService } from '@core/services/base-service';
import { SeedPageService } from '@core/services/seed-page-service';
import { PluginDefaultPageContractMaterializationAction } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-action.enum';
import { PluginDefaultPageContractMaterializationStatus } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-status.enum';
import { PluginDefaultPageContractResolutionStatus } from '@core/default-page-contract/enums/plugin-default-page-contract-resolution-status.enum';
import { PluginDefaultPageContractMaterializationMode } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-mode.enum';
import { PluginDefaultPageContractMaterializationPageMatchSource } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-page-match-source.enum';

/**
 * Builds candidate pages and individual materialization plan entries. Extracted from
 * {@link PluginDefaultPageMaterializationService}; match priorities, reasons and payload
 * shapes are unchanged.
 */
export class PluginDefaultPageMaterializationEntryFactory extends BaseService {
  constructor(private readonly seedPageService: SeedPageService) {
    super();
  }

  get serviceName(): string {
    return 'PluginDefaultPageMaterializationEntryFactory';
  }

  createCandidatePages(existingPages: IPluginDefaultPageContractMaterializationPlanInput['existingPages']): IPluginDefaultPageContractMaterializationCandidatePage[] {
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

  createEntry(
    contract: IResolvedPluginDefaultPageContract,
    pages: IPluginDefaultPageContractMaterializationCandidatePage[],
  ): IPluginDefaultPageContractMaterializationPlanEntry {
    const lookupCandidates = this.buildLookupCandidates(contract);

    if (contract.status === PluginDefaultPageContractResolutionStatus.SKIPPED) {
      return this.createBaseEntry(contract, lookupCandidates, PluginDefaultPageContractMaterializationAction.SKIP, PluginDefaultPageContractMaterializationStatus.SKIPPED, undefined, undefined, contract.reasons);
    }

    if (contract.status === PluginDefaultPageContractResolutionStatus.BLOCKED) {
      return this.createBaseEntry(contract, lookupCandidates, PluginDefaultPageContractMaterializationAction.BLOCKED, PluginDefaultPageContractMaterializationStatus.BLOCKED, undefined, undefined, contract.reasons);
    }

    if (this.isRuntimeParameterizedContract(contract)) {
      return this.createBaseEntry(
        contract,
        lookupCandidates,
        PluginDefaultPageContractMaterializationAction.DEFERRED,
        PluginDefaultPageContractMaterializationStatus.DEFERRED,
        undefined,
        undefined,
        this.createReasons(contract.reasons, 'parameterized-route-deferred'),
      );
    }

    if (contract.materializationMode === PluginDefaultPageContractMaterializationMode.PER_RECORD_DOCUMENT) {
      return this.createBaseEntry(
        contract,
        lookupCandidates,
        PluginDefaultPageContractMaterializationAction.DEFERRED,
        PluginDefaultPageContractMaterializationStatus.DEFERRED,
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
        PluginDefaultPageContractMaterializationAction.AMBIGUOUS,
        PluginDefaultPageContractMaterializationStatus.AMBIGUOUS,
        undefined,
        undefined,
        this.createReasons(contract.reasons, 'multiple-existing-pages-matched'),
      );
    }

    if (matches.length === 1) {
      return this.createBaseEntry(
        contract,
        lookupCandidates,
        PluginDefaultPageContractMaterializationAction.ADOPT_EXISTING,
        PluginDefaultPageContractMaterializationStatus.READY,
        matches[0].matchedPageId,
        undefined,
        this.createReasons(contract.reasons, `matched-by-${matches[0].source}`),
      );
    }

    if (contract.materializationMode === PluginDefaultPageContractMaterializationMode.ADOPT_ONLY) {
      return this.createBaseEntry(
        contract,
        lookupCandidates,
        PluginDefaultPageContractMaterializationAction.BLOCKED,
        PluginDefaultPageContractMaterializationStatus.BLOCKED,
        undefined,
        undefined,
        this.createReasons(contract.reasons, 'adopt-only-no-match'),
      );
    }

    return this.createBaseEntry(
      contract,
      lookupCandidates,
      PluginDefaultPageContractMaterializationAction.CREATE_MISSING,
      PluginDefaultPageContractMaterializationStatus.READY,
      undefined,
      this.createCreatePayload(contract),
      this.createReasons(contract.reasons, 'no-existing-page-match'),
    );
  }

  private buildLookupCandidates(contract: IResolvedPluginDefaultPageContract): string[] {
    const baseCandidates = [...contract.effectiveAliases, ...contract.adoptionHints];

    return this.seedPageService.buildPageLookupCandidates(baseCandidates, {
      customPermalink: contract.effectiveSlug,
      slug: contract.effectiveSlug,
    });
  }

  private findMatches(
    lookupCandidates: string[],
    pages: IPluginDefaultPageContractMaterializationCandidatePage[],
  ): IPluginDefaultPageContractMaterializationPageMatch[] {
    const allMatches = pages
      .map((page) => this.getPageMatch(page, lookupCandidates))
      .filter((match): match is IPluginDefaultPageContractMaterializationPageMatch => Boolean(match));

    if (!allMatches.length) {
      return [];
    }

    const bestPriority = Math.min(...allMatches.map((match) => match.priority));

    return allMatches
      .filter((match) => match.priority === bestPriority)
      .sort((left, right) => String(left.matchedPageId).localeCompare(String(right.matchedPageId)));
  }

  private getPageMatch(
    page: IPluginDefaultPageContractMaterializationCandidatePage,
    lookupCandidates: string[],
  ): IPluginDefaultPageContractMaterializationPageMatch | undefined {
    if (this.hasCandidateMatch(lookupCandidates, page.customPermalinkCandidates)) {
      return {
        matchedPageId: page.id,
        priority: 0,
        source: PluginDefaultPageContractMaterializationPageMatchSource.CUSTOM_PERMALINK,
      };
    }

    if (this.hasCandidateMatch(lookupCandidates, page.slugCandidates)) {
      return {
        matchedPageId: page.id,
        priority: 1,
        source: PluginDefaultPageContractMaterializationPageMatchSource.SLUG,
      };
    }

    return undefined;
  }

  private hasCandidateMatch(lookupCandidates: string[], pageCandidates: string[]): boolean {
    return pageCandidates.some((candidate) => lookupCandidates.includes(candidate));
  }

  private createCreatePayload(contract: IResolvedPluginDefaultPageContract): IPluginDefaultPageContractCreatePayload {
    const resolvedSlug = this.resolveSingletonDocumentSlug(contract.effectiveSlug);

    return {
      canonicalKey: contract.canonicalKey,
      namespace: contract.namespace,
      pluginSlug: contract.pluginSlug,
      key: contract.key,
      slug: resolvedSlug,
      customPermalink: contract.effectiveSlug,
      aliases: [...contract.effectiveAliases],
      recipe: contract.effectiveRecipe,
      title: contract.effectiveTitle,
      themeLayout: contract.effectiveThemeLayout,
      defaultContent: Array.isArray(contract.defaultContent) ? contract.defaultContent : undefined,
    };
  }

  private createBaseEntry(
    contract: IResolvedPluginDefaultPageContract,
    lookupCandidates: string[],
    action: IPluginDefaultPageContractMaterializationPlanEntry['action'],
    status: IPluginDefaultPageContractMaterializationPlanEntry['status'],
    matchedPageId?: IPluginDefaultPageContractMaterializationPlanEntry['matchedPageId'],
    createPayload?: IPluginDefaultPageContractMaterializationPlanEntry['createPayload'],
    reasons?: string[],
  ): IPluginDefaultPageContractMaterializationPlanEntry {
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

  private normalizeOptionalString(value?: string): string | undefined {
    const normalized = String(value || '').trim();
    return normalized || undefined;
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

  private resolveSingletonDocumentSlug(value: string): string {
    const segments = String(value || '').trim().split('?')[0].split('#')[0].split('/').filter(Boolean);
    return segments[segments.length - 1] || String(value || '').trim();
  }
}
