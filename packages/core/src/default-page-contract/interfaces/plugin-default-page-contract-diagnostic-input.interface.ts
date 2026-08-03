import type { IPluginDefaultPageContractResolutionInput } from '@core/default-page-contract/interfaces/plugin-default-page-contract-resolution-input.interface';

import type { IPluginDefaultPageContractDiagnosticMaterializationInput } from '@core/default-page-contract/interfaces/plugin-default-page-contract-diagnostic-materialization-input.interface';
import type { IPluginDefaultPageContractDiagnosticBackfillInput } from '@core/default-page-contract/interfaces/plugin-default-page-contract-diagnostic-backfill-input.interface';

export interface IPluginDefaultPageContractDiagnosticInput {
  resolution?: IPluginDefaultPageContractResolutionInput;
  materialization?: IPluginDefaultPageContractDiagnosticMaterializationInput;
  backfill?: IPluginDefaultPageContractDiagnosticBackfillInput;
}
