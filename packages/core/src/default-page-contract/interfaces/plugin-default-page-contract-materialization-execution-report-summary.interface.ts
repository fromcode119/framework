export interface IPluginDefaultPageContractMaterializationExecutionReportSummary {
  total: number;
  /** Keyed by the enum member's bare `.value` — an Enum instance cannot index a Record. */
  byOutcome: Record<string, number>;
}
