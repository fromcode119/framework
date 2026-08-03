import type { ISecondaryPanelItemManifest } from '@core/interfaces/secondary-panel-item-manifest.interface';

export interface IAdminSecondaryPanelInputItem {
  sourceNamespace: string;
  sourcePlugin: string;
  sourceCanonicalKey: string;
  item: ISecondaryPanelItemManifest;
}
