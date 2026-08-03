import type { IPluginDefaultPageContractPageSnapshot } from '@core/default-page-contract/interfaces/plugin-default-page-contract-page-snapshot.interface';
import type { IPluginDefaultPageContractCreatePayload } from '@core/default-page-contract/interfaces/plugin-default-page-contract-create-payload.interface';

export interface IPluginDefaultPageContractPageCreateRepository {
  createPage(
    payload: IPluginDefaultPageContractCreatePayload,
  ): Promise<IPluginDefaultPageContractPageSnapshot | undefined>;
}
