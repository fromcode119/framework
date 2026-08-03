import type { IAdminSecondaryPanelContext } from '@core/plugin/services/interfaces/admin-secondary-panel-context.interface';
import type { IAdminSecondaryPanelNormalizedItem } from '@core/plugin/services/interfaces/admin-secondary-panel-normalized-item.interface';
import type { IAdminSecondaryPanelPayload } from '@core/plugin/services/interfaces/admin-secondary-panel-payload.interface';

export class AdminSecondaryPanelResolver {
  resolve(items: IAdminSecondaryPanelNormalizedItem[], allowlistEntriesCount: number): IAdminSecondaryPanelPayload {
    const contexts: Record<string, IAdminSecondaryPanelContext> = {};
    const itemsByContext: Record<string, IAdminSecondaryPanelNormalizedItem[]> = {};
    const globalItems: IAdminSecondaryPanelNormalizedItem[] = [];

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
