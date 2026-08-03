import { IRegisteredPluginDefaultPageContract } from '@core/default-page-contract/interfaces/registered-plugin-default-page-contract.interface';
import { PluginDefaultPageContractResolutionStatus } from '@core/default-page-contract/enums/plugin-default-page-contract-resolution-status.enum';
import type { IPluginDefaultPageContractResolutionSources } from '@core/default-page-contract/interfaces/plugin-default-page-contract-resolution-sources.interface';
import type { IPluginDefaultPageContractResolutionProvenance } from '@core/default-page-contract/interfaces/plugin-default-page-contract-resolution-provenance.interface';

export interface IResolvedPluginDefaultPageContract extends IRegisteredPluginDefaultPageContract {
  effectiveAliases: string[];
  effectiveRecipe: string;
  effectiveSlug: string;
  effectiveStyleVariant?: string;
  effectiveThemeLayout?: string;
  effectiveTitle?: string;
  install: boolean;
  prerequisiteReady: boolean;
  provenance: IPluginDefaultPageContractResolutionProvenance;
  reasons: string[];
  sources: IPluginDefaultPageContractResolutionSources;
  status: PluginDefaultPageContractResolutionStatus;
}
