import type {
  PluginDefaultPageContractBackfillAssociationSnapshot,
  PluginDefaultPageContractBackfillPageSnapshot,
  PluginDefaultPageContractBackfillPlan,
  PluginDefaultPageContractBackfillPlanSummary,
} from './plugin-default-page-contract-backfill.interfaces';
import type {
  PluginDefaultPageContractMaterializationPlan,
  PluginDefaultPageContractMaterializationPlanSummary,
  PluginDefaultPageContractPageSnapshot,
} from './plugin-default-page-contract-materialization.interfaces';
import type {
  PluginDefaultPageContractResolutionInput,
  ResolvedPluginDefaultPageContract,
} from './plugin-default-page-contract-resolution.interfaces';
import type { PluginDefaultPageContractResolutionStatus } from './plugin-default-page-contract-resolution.types';

export interface PluginDefaultPageContractDiagnosticMaterializationInput {
  existingPages?: PluginDefaultPageContractPageSnapshot[];
}

export interface PluginDefaultPageContractDiagnosticBackfillInput {
  existingPages?: PluginDefaultPageContractBackfillPageSnapshot[];
  existingAssociations?: PluginDefaultPageContractBackfillAssociationSnapshot;
}

export interface PluginDefaultPageContractDiagnosticInput {
  resolution?: PluginDefaultPageContractResolutionInput;
  materialization?: PluginDefaultPageContractDiagnosticMaterializationInput;
  backfill?: PluginDefaultPageContractDiagnosticBackfillInput;
}

export interface PluginDefaultPageContractDiagnosticResolvedSummary {
  total: number;
  byStatus: Record<PluginDefaultPageContractResolutionStatus, number>;
  installEnabled: number;
  installDisabled: number;
  prerequisiteReady: number;
  prerequisiteBlocked: number;
  overridesApplied: number;
}

export interface PluginDefaultPageContractDiagnosticSummary {
  resolvedContracts: PluginDefaultPageContractDiagnosticResolvedSummary;
  materializationPlan?: PluginDefaultPageContractMaterializationPlanSummary;
  backfillPlan?: PluginDefaultPageContractBackfillPlanSummary;
}

export interface PluginDefaultPageContractDiagnosticReport {
  resolvedContracts: ResolvedPluginDefaultPageContract[];
  materializationPlan?: PluginDefaultPageContractMaterializationPlan;
  backfillPlan?: PluginDefaultPageContractBackfillPlan;
  summary: PluginDefaultPageContractDiagnosticSummary;
}