import { PluginDefaultPageContractMaterializationPageMatchSource } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-page-match-source.enum';

export interface IPluginDefaultPageContractMaterializationPageMatch {
  matchedPageId: number | string;
  priority: number;
  source: PluginDefaultPageContractMaterializationPageMatchSource;
}
