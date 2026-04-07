import type {
  PluginDefaultPageContractBackfillPlan,
  PluginDefaultPageContractBackfillPlanSummary,
  PluginDefaultPageContractDiagnosticBackfillInput,
  PluginDefaultPageContractDiagnosticInput,
  PluginDefaultPageContractDiagnosticMaterializationInput,
  PluginDefaultPageContractDiagnosticReport,
  PluginDefaultPageContractDiagnosticResolvedSummary,
  PluginDefaultPageContractDiagnosticSummary,
  PluginDefaultPageContractMaterializationPlan,
  PluginDefaultPageContractMaterializationPlanSummary,
  ResolvedPluginDefaultPageContract,
} from '../../types';
import { BaseService } from '../base-service';
import { PluginDefaultPageBackfillService } from './plugin-default-page-backfill-service';
import { PluginDefaultPageContractResolutionService } from './plugin-default-page-contract-resolution-service';
import { PluginDefaultPageMaterializationService } from './plugin-default-page-materialization-service';

export class PluginDefaultPageDiagnosticService extends BaseService {
  constructor(
    private readonly resolutionService: PluginDefaultPageContractResolutionService,
    private readonly materializationService: PluginDefaultPageMaterializationService,
    private readonly backfillService: PluginDefaultPageBackfillService,
  ) {
    super();
  }

  get serviceName(): string {
    return 'PluginDefaultPageDiagnosticService';
  }

  createReport(input?: PluginDefaultPageContractDiagnosticInput): PluginDefaultPageContractDiagnosticReport {
    const resolvedContracts = this.resolutionService.resolveAll(input?.resolution);
    const materializationPlan = this.createMaterializationPlan(resolvedContracts, input?.materialization);
    const backfillPlan = this.createBackfillPlan(resolvedContracts, input?.backfill);

    return {
      resolvedContracts,
      materializationPlan,
      backfillPlan,
      summary: this.createSummary(resolvedContracts, materializationPlan?.summary, backfillPlan?.summary),
    };
  }

  private createMaterializationPlan(
    resolvedContracts: ResolvedPluginDefaultPageContract[],
    input?: PluginDefaultPageContractDiagnosticMaterializationInput,
  ): PluginDefaultPageContractMaterializationPlan | undefined {
    if (!input?.existingPages) {
      return undefined;
    }

    return this.materializationService.createPlan({
      resolvedContracts,
      existingPages: input.existingPages,
    });
  }

  private createBackfillPlan(
    resolvedContracts: ResolvedPluginDefaultPageContract[],
    input?: PluginDefaultPageContractDiagnosticBackfillInput,
  ): PluginDefaultPageContractBackfillPlan | undefined {
    if (!input?.existingPages || !input.existingAssociations) {
      return undefined;
    }

    return this.backfillService.createPlan({
      resolvedContracts,
      existingPages: input.existingPages,
      existingAssociations: input.existingAssociations,
    });
  }

  private createSummary(
    resolvedContracts: ResolvedPluginDefaultPageContract[],
    materializationPlanSummary?: PluginDefaultPageContractMaterializationPlanSummary,
    backfillPlanSummary?: PluginDefaultPageContractBackfillPlanSummary,
  ): PluginDefaultPageContractDiagnosticSummary {
    return {
      resolvedContracts: this.createResolvedSummary(resolvedContracts),
      materializationPlan: materializationPlanSummary ? this.cloneMaterializationSummary(materializationPlanSummary) : undefined,
      backfillPlan: backfillPlanSummary ? this.cloneBackfillSummary(backfillPlanSummary) : undefined,
    };
  }

  private createResolvedSummary(
    resolvedContracts: ResolvedPluginDefaultPageContract[],
  ): PluginDefaultPageContractDiagnosticResolvedSummary {
    const summary: PluginDefaultPageContractDiagnosticResolvedSummary = {
      total: resolvedContracts.length,
      byStatus: {
        blocked: 0,
        ready: 0,
        skipped: 0,
      },
      installEnabled: 0,
      installDisabled: 0,
      prerequisiteReady: 0,
      prerequisiteBlocked: 0,
      overridesApplied: 0,
    };

    for (const contract of resolvedContracts) {
      summary.byStatus[contract.status] += 1;
      summary.installEnabled += contract.install ? 1 : 0;
      summary.installDisabled += contract.install ? 0 : 1;
      summary.prerequisiteReady += contract.prerequisiteReady ? 1 : 0;
      summary.prerequisiteBlocked += contract.prerequisiteReady ? 0 : 1;
      summary.overridesApplied += contract.provenance.overrideApplied ? 1 : 0;
    }

    return summary;
  }

  private cloneMaterializationSummary(
    summary: PluginDefaultPageContractMaterializationPlanSummary,
  ): PluginDefaultPageContractMaterializationPlanSummary {
    return {
      total: summary.total,
      byAction: {
        'adopt-existing': summary.byAction['adopt-existing'],
        ambiguous: summary.byAction.ambiguous,
        blocked: summary.byAction.blocked,
        'create-missing': summary.byAction['create-missing'],
        deferred: summary.byAction.deferred,
        skip: summary.byAction.skip,
      },
      byStatus: {
        ambiguous: summary.byStatus.ambiguous,
        blocked: summary.byStatus.blocked,
        deferred: summary.byStatus.deferred,
        ready: summary.byStatus.ready,
        skipped: summary.byStatus.skipped,
      },
    };
  }

  private cloneBackfillSummary(summary: PluginDefaultPageContractBackfillPlanSummary): PluginDefaultPageContractBackfillPlanSummary {
    return {
      total: summary.total,
      byAction: {
        'already-associated': summary.byAction['already-associated'],
        ambiguous: summary.byAction.ambiguous,
        'associate-existing': summary.byAction['associate-existing'],
        blocked: summary.byAction.blocked,
        deferred: summary.byAction.deferred,
        skipped: summary.byAction.skipped,
      },
      byStatus: {
        'already-associated': summary.byStatus['already-associated'],
        ambiguous: summary.byStatus.ambiguous,
        blocked: summary.byStatus.blocked,
        deferred: summary.byStatus.deferred,
        'safe-to-associate': summary.byStatus['safe-to-associate'],
        skipped: summary.byStatus.skipped,
      },
    };
  }
}