import type { IPluginDefaultPageContractMaterializationPlanEntry } from '@core/default-page-contract/interfaces/plugin-default-page-contract-materialization-plan-entry.interface';
import type { IPluginDefaultPageContractMaterializationPlanSummary } from '@core/default-page-contract/interfaces/plugin-default-page-contract-materialization-plan-summary.interface';

export interface IPluginDefaultPageContractMaterializationPlan {
  entries: IPluginDefaultPageContractMaterializationPlanEntry[];
  summary: IPluginDefaultPageContractMaterializationPlanSummary;
}
