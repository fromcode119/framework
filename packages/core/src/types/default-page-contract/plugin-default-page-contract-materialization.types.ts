export type PluginDefaultPageContractMaterializationAction =
  | 'adopt-existing'
  | 'ambiguous'
  | 'blocked'
  | 'create-missing'
  | 'deferred'
  | 'skip';

export type PluginDefaultPageContractMaterializationStatus =
  | 'ambiguous'
  | 'blocked'
  | 'deferred'
  | 'ready'
  | 'skipped';

export type PluginDefaultPageContractAssociationPersistStatus =
  | 'applied'
  | 'conflict'
  | 'noop';

export type PluginDefaultPageContractMaterializationExecutionOutcome =
  | 'applied'
  | 'failed'
  | 'noop'
  | 'skipped';

export type PluginDefaultPageContractMaterializationPageMatchSource =
  | 'customPermalink'
  | 'slug';