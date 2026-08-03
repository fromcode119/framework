import type { ISecondaryPanelContext, ISecondaryPanelItem } from '@fromcode119/react';

export interface ISecondarySidebarResolveResult {
  activeContextId: string;
  activeContext: ISecondaryPanelContext | null;
  activeSourcePath: string;
  items: ISecondaryPanelItem[];
}
