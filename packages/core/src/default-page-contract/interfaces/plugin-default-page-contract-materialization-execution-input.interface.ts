import type { IPluginDefaultPageContractMaterializationPlan } from '@core/default-page-contract/interfaces/plugin-default-page-contract-materialization-plan.interface';
import type { IPluginDefaultPageContractPageLookupRepository } from '@core/default-page-contract/interfaces/plugin-default-page-contract-page-lookup-repository.interface';
import type { IPluginDefaultPageContractPageCreateRepository } from '@core/default-page-contract/interfaces/plugin-default-page-contract-page-create-repository.interface';
import type { IPluginDefaultPageContractAssociationSnapshotRepository } from '@core/default-page-contract/interfaces/plugin-default-page-contract-association-snapshot-repository.interface';
import type { IPluginDefaultPageContractAssociationPersistRepository } from '@core/default-page-contract/interfaces/plugin-default-page-contract-association-persist-repository.interface';

export interface IPluginDefaultPageContractMaterializationExecutionInput {
  plan: IPluginDefaultPageContractMaterializationPlan;
  pageLookupRepository: IPluginDefaultPageContractPageLookupRepository;
  pageCreateRepository: IPluginDefaultPageContractPageCreateRepository;
  associationSnapshotRepository: IPluginDefaultPageContractAssociationSnapshotRepository;
  associationPersistRepository: IPluginDefaultPageContractAssociationPersistRepository;
}
