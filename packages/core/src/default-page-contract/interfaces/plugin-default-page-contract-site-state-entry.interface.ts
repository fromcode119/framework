import { PluginDefaultPageContractResolutionStatus } from '@core/default-page-contract/enums/plugin-default-page-contract-resolution-status.enum';

export interface IPluginDefaultPageContractSiteStateEntry {
  prerequisitesReady?: boolean;
  reasons?: string[];
  status?: PluginDefaultPageContractResolutionStatus;
}
