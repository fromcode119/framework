export type PluginDefaultPageContractKind =
  | 'detail'
  | 'form-page'
  | 'index'
  | 'landing'
  | 'policy';

export type PluginDefaultPageContractMaterializationMode =
  | 'adopt-only'
  | 'per-record-document'
  | 'singleton-document';

export type PluginDefaultPageContractDependency =
  | 'audit'
  | 'email'
  | 'navigation'
  | 'preview'
  | 'search'
  | 'settings'
  | 'sitemap';