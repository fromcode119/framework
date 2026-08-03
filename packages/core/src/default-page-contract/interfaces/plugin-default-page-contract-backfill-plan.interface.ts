import type { IPluginDefaultPageContractBackfillPlanEntry } from '@core/default-page-contract/interfaces/plugin-default-page-contract-backfill-plan-entry.interface';
import type { IPluginDefaultPageContractBackfillPlanSummary } from '@core/default-page-contract/interfaces/plugin-default-page-contract-backfill-plan-summary.interface';

export interface IPluginDefaultPageContractBackfillPlan {
  entries: IPluginDefaultPageContractBackfillPlanEntry[];
  summary: IPluginDefaultPageContractBackfillPlanSummary;
}
