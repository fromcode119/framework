import type { ISecondaryPanelItem } from '@react/interfaces/secondary-panel-item.interface';
import type { ISecondaryPanelContext } from '@react/interfaces/secondary-panel-context.interface';

export interface ISecondaryPanelState {
  version: number;
  contexts: Record<string, ISecondaryPanelContext>;
  itemsByContext: Record<string, ISecondaryPanelItem[]>;
  globalItems: ISecondaryPanelItem[];
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
