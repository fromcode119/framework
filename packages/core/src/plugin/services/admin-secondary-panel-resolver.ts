import {
  AdminSecondaryPanelContext,
  AdminSecondaryPanelNormalizedItem,
  AdminSecondaryPanelPayload,
} from './admin-secondary-panel.interfaces';

export class AdminSecondaryPanelResolver {
  resolve(items: AdminSecondaryPanelNormalizedItem[], allowlistEntriesCount: number): AdminSecondaryPanelPayload {
    const contexts: Record<string, AdminSecondaryPanelContext> = {};
    const itemsByContext: Record<string, AdminSecondaryPanelNormalizedItem[]> = {};
    const globalItems: AdminSecondaryPanelNormalizedItem[] = [];

    for (const item of items) {
      if (item.scope === 'global') {
        globalItems.push(item);
        continue;
      }

      const contextId = item.targetCanonicalKey;
      if (!contexts[contextId]) {
        contexts[contextId] = {
          id: contextId,
          label: item.targetPlugin,
          targetNamespace: item.targetNamespace,
          targetPlugin: item.targetPlugin,
          targetCanonicalKey: item.targetCanonicalKey,
        };
      }
      if (!itemsByContext[contextId]) {
        itemsByContext[contextId] = [];
      }
      itemsByContext[contextId].push(item);
    }

    return {
      version: 1,
      contexts,
      itemsByContext,
      globalItems,
      policy: {
        allowlistKey: 'admin.secondaryPanel.allowlist.v1',
        allowlistEntries: allowlistEntriesCount,
        evaluatedAt: new Date().toISOString(),
      },
      precedence: {
        scopeOrder: ['self', 'plugin-target', 'global'],
        tieBreakOrder: ['priority-asc', 'canonicalId-asc'],
      },
    };
  }
}
