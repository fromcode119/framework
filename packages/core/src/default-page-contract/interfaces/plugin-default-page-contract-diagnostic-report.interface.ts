import type { IPluginDefaultPageContractBackfillPlan } from '@core/default-page-contract/interfaces/plugin-default-page-contract-backfill-plan.interface';
import type { IPluginDefaultPageContractMaterializationPlan } from '@core/default-page-contract/interfaces/plugin-default-page-contract-materialization-plan.interface';
import type { IResolvedPluginDefaultPageContract } from '@core/default-page-contract/interfaces/resolved-plugin-default-page-contract.interface';
import type { IPluginDefaultPageContractDiagnosticSummary } from '@core/default-page-contract/interfaces/plugin-default-page-contract-diagnostic-summary.interface';

export interface IPluginDefaultPageContractDiagnosticReport {
  resolvedContracts: IResolvedPluginDefaultPageContract[];
  materializationPlan?: IPluginDefaultPageContractMaterializationPlan;
  backfillPlan?: IPluginDefaultPageContractBackfillPlan;
  summary: IPluginDefaultPageContractDiagnosticSummary;
}
