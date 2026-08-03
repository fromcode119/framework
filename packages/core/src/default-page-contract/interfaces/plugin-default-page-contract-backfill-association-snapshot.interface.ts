import type { IPluginDefaultPageContractBackfillAssociationSnapshotEntry } from '@core/default-page-contract/interfaces/plugin-default-page-contract-backfill-association-snapshot-entry.interface';

export interface IPluginDefaultPageContractBackfillAssociationSnapshot {
  byCanonicalKey?: Record<string, IPluginDefaultPageContractBackfillAssociationSnapshotEntry>;
  byPageId?: Record<string, IPluginDefaultPageContractBackfillAssociationSnapshotEntry>;
}
