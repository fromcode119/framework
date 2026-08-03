import type { IMenuItem, ISecondaryPanelState } from '@fromcode119/react';

export interface ISecondarySidebarResolveInput {
  pathname: string;
  primaryContextId: string;
  menuItems: IMenuItem[];
  secondaryPanel: ISecondaryPanelState;
  plugins: any[];
  userRoles: string[];
  userCapabilities: string[];
}
