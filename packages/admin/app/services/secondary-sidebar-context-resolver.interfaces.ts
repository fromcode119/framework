import type { MenuItem, SecondaryPanelContext, SecondaryPanelItem, SecondaryPanelState } from '@fromcode119/react';

export interface SecondarySidebarResolveInput {
  pathname: string;
  primaryContextId: string;
  menuItems: MenuItem[];
  secondaryPanel: SecondaryPanelState;
  plugins: any[];
  userRoles: string[];
  userCapabilities: string[];
}

export interface SecondarySidebarResolveResult {
  activeContextId: string;
  activeContext: SecondaryPanelContext | null;
  activeSourcePath: string;
  items: SecondaryPanelItem[];
}
