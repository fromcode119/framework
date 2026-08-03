import type { IThemeDefaultPageContractOverride } from '@core/default-page-contract/interfaces/theme-default-page-contract-override.interface';
import type { IPluginDefaultPageContractSiteStateSnapshot } from '@core/default-page-contract/interfaces/plugin-default-page-contract-site-state-snapshot.interface';

export interface IPluginDefaultPageContractResolutionInput {
  overrides?: IThemeDefaultPageContractOverride[];
  siteState?: IPluginDefaultPageContractSiteStateSnapshot;
}
