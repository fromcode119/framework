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
  title?: string;
  themeLayout?: string;
  styleVariant?: string;
  materializationMode: PluginDefaultPageContractMaterializationMode;
  dependencies: PluginDefaultPageContractDependency[];
  adoptionHints: string[];
  required: boolean;
  aliases?: string[];
  /**
   * Optional default block content the materializer writes when creating this page (instead
   * of an empty `[]`). Lets a plugin own its route AND its default block (e.g. an affiliate
   * portal block), so the theme only OVERRIDES the block renderer for branding — no theme/seed
   * needed to place the block.
   */
  defaultContent?: any[];
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
  styleVariant?: string;
  recipe?: string;
  install?: boolean;
}