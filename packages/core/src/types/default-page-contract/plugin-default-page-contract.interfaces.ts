import type {
  PluginDefaultPageContractDependency,
  PluginDefaultPageContractKind,
  PluginDefaultPageContractMaterializationMode,
} from './plugin-default-page-contract.types';

export interface PluginDefaultPageContract {
  key: string;
  kind: PluginDefaultPageContractKind;
  defaultSlug: string;
  recordCollection?: string;
  capability: string;
  recipe: string;
  materializationMode: PluginDefaultPageContractMaterializationMode;
  dependencies: PluginDefaultPageContractDependency[];
  adoptionHints: string[];
  required: boolean;
  aliases?: string[];
}

export interface PluginDefaultPageContractRegistration {
  namespace: string;
  pluginSlug: string;
  contracts: PluginDefaultPageContract[];
}

export interface PluginDefaultPageContractIdentity {
  namespace: string;
  pluginSlug: string;
  key: string;
}

export interface RegisteredPluginDefaultPageContract
  extends PluginDefaultPageContract, PluginDefaultPageContractIdentity {
  canonicalKey: string;
}

export interface ThemeDefaultPageContractOverride {
  contract: PluginDefaultPageContractIdentity;
  slug?: string;
  aliases?: string[];
  title?: string;
  themeLayout?: string;
  recipe?: string;
  install?: boolean;
}