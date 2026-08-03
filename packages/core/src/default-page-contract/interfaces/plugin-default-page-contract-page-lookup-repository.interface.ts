import type { IPluginDefaultPageContractPageSnapshot } from '@core/default-page-contract/interfaces/plugin-default-page-contract-page-snapshot.interface';

export interface IPluginDefaultPageContractPageLookupRepository {
  findPageById(pageId: number | string): Promise<IPluginDefaultPageContractPageSnapshot | undefined>;
}
