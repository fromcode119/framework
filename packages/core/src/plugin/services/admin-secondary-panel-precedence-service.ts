import { AdminSecondaryPanelNormalizedItem } from './admin-secondary-panel.interfaces';

export class AdminSecondaryPanelPrecedenceService {
  apply(items: AdminSecondaryPanelNormalizedItem[]): AdminSecondaryPanelNormalizedItem[] {
    const ranked = items.slice().sort((a, b) => this.compareByPrecedence(a, b));

    const dedupedByCanonicalId = new Set<string>();
    const canonicalFiltered: AdminSecondaryPanelNormalizedItem[] = [];
    for (const item of ranked) {
      if (dedupedByCanonicalId.has(item.canonicalId)) {
        continue;
      }
      dedupedByCanonicalId.add(item.canonicalId);
      canonicalFiltered.push(item);
    }

    const dedupedByComposite = new Set<string>();
    const compositeFiltered: AdminSecondaryPanelNormalizedItem[] = [];
    for (const item of canonicalFiltered) {
      const compositeKey = this.compositeKey(item);
      if (dedupedByComposite.has(compositeKey)) {
        continue;
      }
      dedupedByComposite.add(compositeKey);
      compositeFiltered.push(item);
    }

    return compositeFiltered;
  }

  private compareByPrecedence(a: AdminSecondaryPanelNormalizedItem, b: AdminSecondaryPanelNormalizedItem): number {
    const scopeDiff = this.scopeRank(a.scope) - this.scopeRank(b.scope);
    if (scopeDiff !== 0) {
      return scopeDiff;
    }

    const priorityDiff = a.priority - b.priority;
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return a.canonicalId.localeCompare(b.canonicalId);
  }

  private compositeKey(item: AdminSecondaryPanelNormalizedItem): string {
    const normalizedPath = String(item.path || '').trim().toLowerCase();
    const normalizedLabel = String(item.label || '').trim().toLowerCase();
    const contextKey = item.scope === 'global' ? 'global' : item.targetCanonicalKey;
    return `${contextKey}::${normalizedPath}::${normalizedLabel}`;
  }

  private scopeRank(scope: string): number {
    if (scope === 'self') {
      return 0;
    }
    if (scope === 'plugin-target') {
      return 1;
    }
    return 2;
  }
}
