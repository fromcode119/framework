import type { ResolvedPluginDefaultPageContract } from '@fromcode119/core';

export class ResolutionContractPresentationService {
  static applyToDoc(doc: any, contract: ResolvedPluginDefaultPageContract): any {
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

  private static hasDisplayTitle(doc: any): boolean {
    return this.hasText(doc?.title) || this.hasText(doc?.name);
  }

  private static hasText(value: any): boolean {
    return typeof value === 'string' && value.trim().length > 0;
  }
}