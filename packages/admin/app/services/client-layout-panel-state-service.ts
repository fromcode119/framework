import type { SecondaryPanelState } from '@fromcode119/react';

export class ClientLayoutPanelStateService {
  static createEmptyState(): SecondaryPanelState {
    return {
      version: 1,
      contexts: {},
      itemsByContext: {},
      globalItems: [],
      policy: {
        allowlistKey: 'admin.secondaryPanel.allowlist.v1',
        allowlistEntries: 0,
        evaluatedAt: new Date(0).toISOString(),
      },
      precedence: {
        scopeOrder: ['self', 'plugin-target', 'global'],
        tieBreakOrder: ['priority-asc', 'canonicalId-asc'],
      },
    };
  }
}
