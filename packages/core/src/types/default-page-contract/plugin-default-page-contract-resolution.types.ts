export type PluginDefaultPageContractResolutionSource =
  | 'declaration'
  | 'site-state'
  | 'theme-override';

export type PluginDefaultPageContractResolutionStatus =
  | 'blocked'
  | 'ready'
  | 'skipped';

export type PluginDefaultPageContractSiteStateMatch =
  | 'both'
  | 'canonicalKey'
  | 'capability'
  | 'none';