import type { IResolvedPluginDefaultPageContract } from '@fromcode119/core';

export class ResolutionContractPresentationService {
  static applyToDoc(doc: any, contract: IResolvedPluginDefaultPageContract): any {
    if (!doc || typeof doc !== 'object') {
      return doc;
    }

    const nextDoc = { ...doc };

    if (contract.effectiveThemeLayout && !doc.themeLayout && !doc.pageTemplate) {
      nextDoc.themeLayout = contract.effectiveThemeLayout;
    }

    if (contract.effectiveStyleVariant && !doc.styleVariant) {
      nextDoc.styleVariant = contract.effectiveStyleVariant;
    }

    if (contract.effectiveTitle && !this.hasDisplayTitle(doc)) {
      nextDoc.title = contract.effectiveTitle;
    }

    return nextDoc;
  }

  /**
   * A singleton contract page the operator has left BLANK renders its plugin's own design.
   *
   * The storefront picks a plugin page layout by `doc.recipe`, and the storefront pages collection has
   * no `recipe` field: the materializer's write of it is dropped, so nothing ever carried the recipe to
   * the page. Every materialized contract page (/shop, /cookies-policy, /contact, …) was published
   * empty and rendered "No collection records available" instead of the design the plugin registered.
   *
   * Only a page with no content of its own, naming no recipe itself, receives it. A page the operator
   * wrote blocks for renders those blocks — the contract never replaces authored content.
   */
  static applyDesignToBlankPage(doc: any, contract: IResolvedPluginDefaultPageContract): any {
    if (!doc || typeof doc !== 'object' || !contract.effectiveRecipe) {
      return doc;
    }
    if (this.hasText(doc.recipe) || !this.isBlankContent(doc.content)) {
      return doc;
    }

    return { ...doc, recipe: contract.effectiveRecipe };
  }

  /** No blocks anywhere: nothing, an empty list, blank text, or a per-locale map of those. */
  private static isBlankContent(content: any): boolean {
    if (content === null || content === undefined) return true;
    if (Array.isArray(content)) return content.length === 0;
    if (content instanceof Object) return Object.values(content).every((value) => this.isBlankContent(value));
    return String(content).trim().length === 0;
  }

  private static hasDisplayTitle(doc: any): boolean {
    return this.hasText(doc?.title) || this.hasText(doc?.name);
  }

  private static hasText(value: any): boolean {
    return typeof value === 'string' && value.trim().length > 0;
  }
}