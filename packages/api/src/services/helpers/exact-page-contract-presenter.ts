import type { ICollection, IResolvedPluginDefaultPageContract } from '@fromcode119/core';
import { PluginDefaultPageContractMaterializationMode } from '@fromcode119/core';
import { PluginDefaultPageContractResolutionStatus } from '@fromcode119/core';
import { ResolutionContractPathService } from '@api/services/helpers/resolution-contract-path-service';
import { ResolutionContractPresentationService } from '@api/services/helpers/resolution-contract-presentation-service';

/**
 * What a plugin's default-page contract contributes to a page the resolver found by EXACT match.
 *
 * The page exists and is the operator's, so the contract fills only what the page itself leaves
 * blank — a layout where the page names none, a title where the page has neither title nor name.
 * Anything more would be the contract overriding what an admin set, which is exactly the magic this
 * codebase does not allow.
 */
export class ExactPageContractPresenter {
  /** The one collection a default-page contract can present through. */
  private static readonly PAGES = 'pages';

  /** The slug the record was FOUND by, when the record itself carries none. */
  static withResolvedSlug(doc: any, resolvedSlug: string): any {
    if (!doc || typeof doc !== 'object') return doc;
    const existing = String(doc.slug ?? '').trim();
    if (existing) return doc;
    const fallback = String(resolvedSlug ?? '').trim();
    return fallback ? { ...doc, slug: fallback } : doc;
  }

  /**
   * A READY singleton contract whose route is this exact path — no path parameters, so it names one
   * page rather than a family of them.
   */
  private static matchesSingleton(
    contract: IResolvedPluginDefaultPageContract,
    normalizedInput: string,
  ): boolean {
    if (!contract.install || contract.status !== PluginDefaultPageContractResolutionStatus.READY) {
      return false;
    }

    if (contract.materializationMode !== PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT) {
      return false;
    }

    const matchingPattern = ResolutionContractPathService.findMatchingPattern(contract, normalizedInput);
    if (!matchingPattern) {
      return false;
    }

    return !ResolutionContractPathService.hasPathParameters(matchingPattern);
  }

  /** The document, with the contract's layout or title filled in only where the page has neither. */
  static apply(
    doc: any,
    collection: ICollection,
    normalizedInput: string,
    resolvedContracts: IResolvedPluginDefaultPageContract[],
  ): any {
    if (!doc || typeof doc !== 'object') {
      return doc;
    }

    const collectionType = String(collection.shortSlug || collection.slug || '').trim();
    if (collectionType !== ExactPageContractPresenter.PAGES) {
      return doc;
    }

    const matchingContract = resolvedContracts.find(
      (contract) => ExactPageContractPresenter.matchesSingleton(contract, normalizedInput),
    );
    if (!matchingContract) {
      return doc;
    }

    if (matchingContract.effectiveThemeLayout && !doc.themeLayout && !doc.pageTemplate) {
      return ResolutionContractPresentationService.applyToDoc(doc, matchingContract);
    }

    if (matchingContract.effectiveTitle && (!doc.title || !String(doc.title).trim()) && (!doc.name || !String(doc.name).trim())) {
      return ResolutionContractPresentationService.applyToDoc(doc, matchingContract);
    }

    return doc;
  }
}
