
import { PluginDefaultPageContractMaterializationMode } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-mode.enum';
import { PluginDefaultPageContractMaterializationAction } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-action.enum';
import { PluginDefaultPageContractMaterializationExecutionOutcome } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-execution-outcome.enum';
import { PluginDefaultPageContractMaterializationStatus } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-status.enum';

export interface IPluginDefaultPageContractMaterializationExecutionEntrySummary {
  canonicalKey: string;
  namespace: string;
  pluginSlug: string;
  key: string;
  action: PluginDefaultPageContractMaterializationAction;
  status: PluginDefaultPageContractMaterializationStatus;
  materializationMode: PluginDefaultPageContractMaterializationMode;
  matchedPageId?: number | string;
  executionOutcome: PluginDefaultPageContractMaterializationExecutionOutcome;
  reasons: string[];
}
