export interface IPluginDefaultPageContractDiagnosticResolvedSummary {
  total: number;
  /** Keyed by the enum member's bare `.value` — an Enum instance cannot index a Record. */
  byStatus: Record<string, number>;
  installEnabled: number;
  installDisabled: number;
  prerequisiteReady: number;
  prerequisiteBlocked: number;
  overridesApplied: number;
}
