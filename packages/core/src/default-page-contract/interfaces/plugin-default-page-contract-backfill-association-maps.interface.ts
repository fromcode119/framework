import type { IPluginDefaultPageContractBackfillAssociationRecord } from '@core/default-page-contract/interfaces/plugin-default-page-contract-backfill-association-record.interface';
import type { IPluginDefaultPageContractBackfillAssociationConflicts } from '@core/default-page-contract/interfaces/plugin-default-page-contract-backfill-association-conflicts.interface';

export interface IPluginDefaultPageContractBackfillAssociationMaps {
  byCanonicalKey: Map<string, IPluginDefaultPageContractBackfillAssociationRecord>;
  byPageId: Map<string, IPluginDefaultPageContractBackfillAssociationRecord>;
  conflicts: IPluginDefaultPageContractBackfillAssociationConflicts;
}
