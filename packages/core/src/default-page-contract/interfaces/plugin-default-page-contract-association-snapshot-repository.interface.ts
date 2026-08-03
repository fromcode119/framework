import type { IPluginDefaultPageContractBackfillAssociationSnapshot } from '@core/default-page-contract/interfaces/plugin-default-page-contract-backfill-association-snapshot.interface';

export interface IPluginDefaultPageContractAssociationSnapshotRepository {
  getAssociationSnapshot(): Promise<IPluginDefaultPageContractBackfillAssociationSnapshot>;
}
