import { PluginDefaultPageContractBackfillMatchSource } from '@core/default-page-contract/enums/plugin-default-page-contract-backfill-match-source.enum';

export interface IPluginDefaultPageContractBackfillPageMatch {
  matchedPageId: number | string;
  priority: number;
  source: PluginDefaultPageContractBackfillMatchSource;
}
