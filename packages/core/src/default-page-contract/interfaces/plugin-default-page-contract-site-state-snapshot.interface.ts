import type { IPluginDefaultPageContractSiteStateEntry } from '@core/default-page-contract/interfaces/plugin-default-page-contract-site-state-entry.interface';

export interface IPluginDefaultPageContractSiteStateSnapshot {
  byCanonicalKey?: Record<string, IPluginDefaultPageContractSiteStateEntry>;
  byCapability?: Record<string, IPluginDefaultPageContractSiteStateEntry>;
}
