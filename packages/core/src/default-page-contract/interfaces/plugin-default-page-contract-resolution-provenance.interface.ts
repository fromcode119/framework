import { PluginDefaultPageContractSiteStateMatch } from '@core/default-page-contract/enums/plugin-default-page-contract-site-state-match.enum';

export interface IPluginDefaultPageContractResolutionProvenance {
  overrideApplied: boolean;
  overrideCanonicalKey?: string;
  siteStateMatch: PluginDefaultPageContractSiteStateMatch;
}
