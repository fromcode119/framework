export type PluginDefaultPageContractBackfillAction =
  | 'already-associated'
  | 'ambiguous'
  | 'associate-existing'
  | 'blocked'
  | 'deferred'
  | 'skipped';

export type PluginDefaultPageContractBackfillStatus =
  | 'already-associated'
  | 'ambiguous'
  | 'blocked'
  | 'deferred'
  | 'safe-to-associate'
  | 'skipped';

export type PluginDefaultPageContractBackfillMatchSource =
  | 'customPermalink'
  | 'slug';