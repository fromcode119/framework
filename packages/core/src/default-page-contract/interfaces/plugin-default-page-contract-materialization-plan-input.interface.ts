import type { IResolvedPluginDefaultPageContract } from '@core/default-page-contract/interfaces/resolved-plugin-default-page-contract.interface';
import type { IPluginDefaultPageContractPageSnapshot } from '@core/default-page-contract/interfaces/plugin-default-page-contract-page-snapshot.interface';

export interface IPluginDefaultPageContractMaterializationPlanInput {
  resolvedContracts: IResolvedPluginDefaultPageContract[];
  existingPages: IPluginDefaultPageContractPageSnapshot[];
}
