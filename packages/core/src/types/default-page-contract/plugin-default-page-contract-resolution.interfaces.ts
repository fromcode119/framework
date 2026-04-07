import type {
  RegisteredPluginDefaultPageContract,
  ThemeDefaultPageContractOverride,
} from './plugin-default-page-contract.interfaces';
import type {
  PluginDefaultPageContractResolutionSource,
  PluginDefaultPageContractResolutionStatus,
  PluginDefaultPageContractSiteStateMatch,
} from './plugin-default-page-contract-resolution.types';

export interface PluginDefaultPageContractSiteStateEntry {
  prerequisitesReady?: boolean;
  reasons?: string[];
  status?: PluginDefaultPageContractResolutionStatus;
}

export interface PluginDefaultPageContractSiteStateSnapshot {
  byCanonicalKey?: Record<string, PluginDefaultPageContractSiteStateEntry>;
  byCapability?: Record<string, PluginDefaultPageContractSiteStateEntry>;
}

export interface PluginDefaultPageContractResolutionInput {
  overrides?: ThemeDefaultPageContractOverride[];
  siteState?: PluginDefaultPageContractSiteStateSnapshot;
}

export interface PluginDefaultPageContractResolutionSources {
  effectiveAliases: PluginDefaultPageContractResolutionSource;
  effectiveRecipe: PluginDefaultPageContractResolutionSource;
  effectiveSlug: PluginDefaultPageContractResolutionSource;
  effectiveThemeLayout: PluginDefaultPageContractResolutionSource;
  effectiveTitle: PluginDefaultPageContractResolutionSource;
  install: PluginDefaultPageContractResolutionSource;
  prerequisiteReady: PluginDefaultPageContractResolutionSource;
  status: PluginDefaultPageContractResolutionSource;
}

export interface PluginDefaultPageContractResolutionProvenance {
  overrideApplied: boolean;
  overrideCanonicalKey?: string;
  siteStateMatch: PluginDefaultPageContractSiteStateMatch;
}

export interface ResolvedPluginDefaultPageContract extends RegisteredPluginDefaultPageContract {
  effectiveAliases: string[];
  effectiveRecipe: string;
  effectiveSlug: string;
  effectiveThemeLayout?: string;
  effectiveTitle?: string;
  install: boolean;
  prerequisiteReady: boolean;
  provenance: PluginDefaultPageContractResolutionProvenance;
  reasons: string[];
  sources: PluginDefaultPageContractResolutionSources;
  status: PluginDefaultPageContractResolutionStatus;
}