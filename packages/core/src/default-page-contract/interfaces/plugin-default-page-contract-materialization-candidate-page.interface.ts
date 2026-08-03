import { IPluginDefaultPageContractPageSnapshot } from '@core/default-page-contract/interfaces/plugin-default-page-contract-page-snapshot.interface';

export interface IPluginDefaultPageContractMaterializationCandidatePage extends IPluginDefaultPageContractPageSnapshot {
  customPermalinkCandidates: string[];
  slugCandidates: string[];
}
