import type { IAdminSecondaryPanelNormalizedItem } from '@core/plugin/services/interfaces/admin-secondary-panel-normalized-item.interface';
import type { IAdminSecondaryPanelContext } from '@core/plugin/services/interfaces/admin-secondary-panel-context.interface';

export interface IAdminSecondaryPanelPayload {
  version: number;
  contexts: Record<string, IAdminSecondaryPanelContext>;
  itemsByContext: Record<string, IAdminSecondaryPanelNormalizedItem[]>;
  globalItems: IAdminSecondaryPanelNormalizedItem[];
  policy: {
    allowlistKey: string;
    allowlistEntries: number;
    evaluatedAt: string;
  };
  precedence: {
    scopeOrder: string[];
    tieBreakOrder: string[];
  };
}
