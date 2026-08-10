import { PluginDefaultPageContractMaterializationExecutionOutcome } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-execution-outcome.enum';
import { PluginDefaultPageContractMaterializationMode } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-mode.enum';
import { PluginDefaultPageContractResolutionStatus } from '@core/default-page-contract/enums/plugin-default-page-contract-resolution-status.enum';
import type { IPluginDefaultPageContractMaterializationExecutionReport } from '@core/default-page-contract/interfaces/plugin-default-page-contract-materialization-execution-report.interface';
import type { IResolvedPluginDefaultPageContract } from '@core/default-page-contract/interfaces/resolved-plugin-default-page-contract.interface';

/**
 * Pure assertion logic verifying that every REQUIRED default-page route reconciled
 * successfully. Extracted from {@link PluginDefaultPageMaterializationRuntimeService};
 * the thrown-error message format is preserved.
 */
export class PluginDefaultPageRequiredRouteAssertion {
  static readonly REQUIRED_ROUTE_FAILURE_LABEL = 'Required route reconciliation failed';

  constructor(private readonly serviceName: string) {}

  static isRequiredRouteFailure(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error || '');
    return message.includes(PluginDefaultPageRequiredRouteAssertion.REQUIRED_ROUTE_FAILURE_LABEL);
  }

  /**
   * Every required route that did not reconcile, as formatted failure descriptions.
   *
   * Pass `ownerPluginSlug` to narrow the result to the routes that plugin declared. A caller
   * materializing on behalf of one plugin only gets to fail for that plugin's own routes.
   */
  collectRequiredRouteFailures(
    report: IPluginDefaultPageContractMaterializationExecutionReport | null,
    resolvedContracts: IResolvedPluginDefaultPageContract[],
    ownerPluginSlug?: string,
  ): string[] {
    const reportByCanonicalKey = new Map((report?.entries || []).map((entry) => [entry.canonicalKey, entry]));
    const owner = String(ownerPluginSlug || '').trim();

    return resolvedContracts
      .filter((contract) => contract.required)
      .filter((contract) => !owner || contract.pluginSlug === owner)
      .flatMap((contract) => this.getRequiredRouteFailures(contract, reportByCanonicalKey, report));
  }

  /**
   * Throws for the required routes DECLARED BY `ownerPluginSlug` that failed to reconcile.
   *
   * The owner filter is the whole point. This assertion runs once per plugin activation, and a throw
   * aborts that activation — so an unscoped assertion made one broken route fail the registration of
   * every plugin activated after it, and of everything depending on those, until nothing served a
   * route. A plugin can only be failed by its own contract now; a broken route belonging to someone
   * else is the caller's to report, not to die on.
   */
  assertRequiredRouteReconciliation(
    report: IPluginDefaultPageContractMaterializationExecutionReport | null,
    resolvedContracts: IResolvedPluginDefaultPageContract[],
    ownerPluginSlug?: string,
  ): void {
    const failures = this.collectRequiredRouteFailures(report, resolvedContracts, ownerPluginSlug);

    if (!failures.length) {
      return;
    }

    throw new Error(
      `[${this.serviceName}] ${PluginDefaultPageRequiredRouteAssertion.REQUIRED_ROUTE_FAILURE_LABEL}: ${failures.join('; ')}`,
    );
  }

  private getRequiredRouteFailures(
    contract: IResolvedPluginDefaultPageContract,
    reportByCanonicalKey: Map<string, IPluginDefaultPageContractMaterializationExecutionReport['entries'][number]>,
    report: IPluginDefaultPageContractMaterializationExecutionReport | null,
  ): string[] {
    if (!contract.install || contract.status !== PluginDefaultPageContractResolutionStatus.READY) {
      return [this.formatRequiredRouteFailure(contract.canonicalKey, contract.reasons, 'contract-not-ready')];
    }

    if (this.isRuntimeParameterizedContract(contract) || contract.materializationMode !== PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT) {
      return [];
    }

    if (!report) {
      return [this.formatRequiredRouteFailure(contract.canonicalKey, [], 'pages-collection-missing')];
    }

    const entry = reportByCanonicalKey.get(contract.canonicalKey);
    if (!entry) {
      return [this.formatRequiredRouteFailure(contract.canonicalKey, [], 'reconciliation-entry-missing')];
    }

    if (entry.executionOutcome === PluginDefaultPageContractMaterializationExecutionOutcome.APPLIED || entry.executionOutcome === PluginDefaultPageContractMaterializationExecutionOutcome.NOOP) {
      return [];
    }

    return [this.formatRequiredRouteFailure(contract.canonicalKey, entry.reasons, entry.executionOutcome.value)];
  }

  private formatRequiredRouteFailure(canonicalKey: string, reasons: string[], fallbackReason: string): string {
    const normalizedReasons = Array.from(
      new Set(
        [...(reasons || []), fallbackReason]
          .map((reason) => String(reason || '').trim())
          .filter(Boolean),
      ),
    );

    return `${canonicalKey} (${normalizedReasons.join(', ')})`;
  }

  private isRuntimeParameterizedContract(contract: IResolvedPluginDefaultPageContract): boolean {
    return contract.materializationMode === PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT && this.hasPathParameters(contract.effectiveSlug);
  }

  private hasPathParameters(value: string): boolean {
    return String(value || '')
      .trim()
      .split('?')[0]
      .split('#')[0]
      .split('/')
      .filter(Boolean)
      .some((segment) => segment.startsWith(':'));
  }
}
