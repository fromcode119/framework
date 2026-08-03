export interface IPluginDefaultPageContractBackfillPlanSummary {
  total: number;
  /** Keyed by the enum member's bare `.value` — an Enum instance cannot index a Record. */
  byAction: Record<string, number>;
  byStatus: Record<string, number>;
}
