import { PluginDefaultPageContractResolutionSource } from '@core/default-page-contract/enums/plugin-default-page-contract-resolution-source.enum';

export interface IPluginDefaultPageContractResolutionSources {
  effectiveAliases: PluginDefaultPageContractResolutionSource;
  effectiveRecipe: PluginDefaultPageContractResolutionSource;
  effectiveSlug: PluginDefaultPageContractResolutionSource;
  effectiveStyleVariant: PluginDefaultPageContractResolutionSource;
  effectiveThemeLayout: PluginDefaultPageContractResolutionSource;
  effectiveTitle: PluginDefaultPageContractResolutionSource;
  install: PluginDefaultPageContractResolutionSource;
  prerequisiteReady: PluginDefaultPageContractResolutionSource;
  status: PluginDefaultPageContractResolutionSource;
}
