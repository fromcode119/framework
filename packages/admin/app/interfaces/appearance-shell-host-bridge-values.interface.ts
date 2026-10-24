import type { ISecondaryPanelState } from '@fromcode119/react';

/** Hook values the {@link AppearanceShellHostShim} bridge reads before projecting the nav model. */
export interface IAppearanceShellHostBridgeValues {
  menuItems: any[];
  secondaryPanel: ISecondaryPanelState | null | undefined;
  user: any;
  pathname: string;
}
