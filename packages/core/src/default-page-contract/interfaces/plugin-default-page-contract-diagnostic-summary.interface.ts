import type { IPluginDefaultPageContractBackfillPlanSummary } from '@core/default-page-contract/interfaces/plugin-default-page-contract-backfill-plan-summary.interface';
import type { IPluginDefaultPageContractMaterializationPlanSummary } from '@core/default-page-contract/interfaces/plugin-default-page-contract-materialization-plan-summary.interface';
import type { IPluginDefaultPageContractDiagnosticResolvedSummary } from '@core/default-page-contract/interfaces/plugin-default-page-contract-diagnostic-resolved-summary.interface';

export interface IPluginDefaultPageContractDiagnosticSummary {
  resolvedContracts: IPluginDefaultPageContractDiagnosticResolvedSummary;
  materializationPlan?: IPluginDefaultPageContractMaterializationPlanSummary;
  backfillPlan?: IPluginDefaultPageContractBackfillPlanSummary;
}
