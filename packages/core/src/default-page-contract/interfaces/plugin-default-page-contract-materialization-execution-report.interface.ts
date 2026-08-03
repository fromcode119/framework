import type { IPluginDefaultPageContractMaterializationExecutionEntrySummary } from '@core/default-page-contract/interfaces/plugin-default-page-contract-materialization-execution-entry-summary.interface';
import type { IPluginDefaultPageContractMaterializationExecutionReportSummary } from '@core/default-page-contract/interfaces/plugin-default-page-contract-materialization-execution-report-summary.interface';

export interface IPluginDefaultPageContractMaterializationExecutionReport {
  entries: IPluginDefaultPageContractMaterializationExecutionEntrySummary[];
  summary: IPluginDefaultPageContractMaterializationExecutionReportSummary;
}
