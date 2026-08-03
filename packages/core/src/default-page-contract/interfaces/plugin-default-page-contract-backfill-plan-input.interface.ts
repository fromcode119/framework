import type { IResolvedPluginDefaultPageContract } from '@core/default-page-contract/interfaces/resolved-plugin-default-page-contract.interface';
import type { IPluginDefaultPageContractBackfillPageSnapshot } from '@core/default-page-contract/interfaces/plugin-default-page-contract-backfill-page-snapshot.interface';
import type { IPluginDefaultPageContractBackfillAssociationSnapshot } from '@core/default-page-contract/interfaces/plugin-default-page-contract-backfill-association-snapshot.interface';

export interface IPluginDefaultPageContractBackfillPlanInput {
  resolvedContracts: IResolvedPluginDefaultPageContract[];
  existingPages: IPluginDefaultPageContractBackfillPageSnapshot[];
  existingAssociations: IPluginDefaultPageContractBackfillAssociationSnapshot;
}
