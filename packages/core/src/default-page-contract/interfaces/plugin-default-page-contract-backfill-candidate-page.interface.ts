import { IPluginDefaultPageContractBackfillPageSnapshot } from '@core/default-page-contract/interfaces/plugin-default-page-contract-backfill-page-snapshot.interface';

export interface IPluginDefaultPageContractBackfillCandidatePage extends IPluginDefaultPageContractBackfillPageSnapshot {
  customPermalinkCandidates: string[];
  slugCandidates: string[];
}
