import type { IPluginDefaultPageContract } from '@core/default-page-contract/interfaces/plugin-default-page-contract.interface';

export interface IPluginDefaultPageContractRegistration {
  namespace: string;
  pluginSlug: string;
  contracts: IPluginDefaultPageContract[];
}
