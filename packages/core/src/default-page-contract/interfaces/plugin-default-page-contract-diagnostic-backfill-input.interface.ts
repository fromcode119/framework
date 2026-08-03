import type { IPluginDefaultPageContractBackfillAssociationSnapshot } from '@core/default-page-contract/interfaces/plugin-default-page-contract-backfill-association-snapshot.interface';
import type { IPluginDefaultPageContractBackfillPageSnapshot } from '@core/default-page-contract/interfaces/plugin-default-page-contract-backfill-page-snapshot.interface';

export interface IPluginDefaultPageContractDiagnosticBackfillInput {
  existingPages?: IPluginDefaultPageContractBackfillPageSnapshot[];
  existingAssociations?: IPluginDefaultPageContractBackfillAssociationSnapshot;
}
