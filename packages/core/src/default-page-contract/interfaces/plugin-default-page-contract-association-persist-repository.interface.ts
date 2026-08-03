import type { IPluginDefaultPageContractAssociationPersistInput } from '@core/default-page-contract/interfaces/plugin-default-page-contract-association-persist-input.interface';
import type { IPluginDefaultPageContractAssociationPersistResult } from '@core/default-page-contract/interfaces/plugin-default-page-contract-association-persist-result.interface';

export interface IPluginDefaultPageContractAssociationPersistRepository {
  persistAssociation(
    input: IPluginDefaultPageContractAssociationPersistInput,
  ): Promise<IPluginDefaultPageContractAssociationPersistResult>;
}
