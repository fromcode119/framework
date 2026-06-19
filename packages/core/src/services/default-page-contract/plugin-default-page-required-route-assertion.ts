import type {
  PluginDefaultPageContractMaterializationExecutionReport,
  ResolvedPluginDefaultPageContract,
} from '../../types';

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

  assertRequiredRouteReconciliation(
    report: PluginDefaultPageContractMaterializationExecutionReport | null,
    resolvedContracts: ResolvedPluginDefaultPageContract[],
  ): void {
    const reportByCanonicalKey = new Map((report?.entries || []).map((entry) => [entry.canonicalKey, entry]));
    const failures = resolvedContracts
      .filter((contract) => contract.required)
      .flatMap((contract) => this.getRequiredRouteFailures(contract, reportByCanonicalKey, report));

    if (!failures.length) {
      return;
    }

    throw new Error(
      `[${this.serviceName}] ${PluginDefaultPageRequiredRouteAssertion.REQUIRED_ROUTE_FAILURE_LABEL}: ${failures.join('; ')}`,
    );
  }

  private getRequiredRouteFailures(
    contract: ResolvedPluginDefaultPageContract,
    reportByCanonicalKey: Map<string, PluginDefaultPageContractMaterializationExecutionReport['entries'][number]>,
    report: PluginDefaultPageContractMaterializationExecutionReport | null,
  ): string[] {
    if (!contract.install || contract.status !== 'ready') {
      return [this.formatRequiredRouteFailure(contract.canonicalKey, contract.reasons, 'contract-not-ready')];
    }

    if (this.isRuntimeParameterizedContract(contract) || contract.materializationMode !== 'singleton-document') {
      return [];
    }

    if (!report) {
      return [this.formatRequiredRouteFailure(contract.canonicalKey, [], 'pages-collection-missing')];
    }

    const entry = reportByCanonicalKey.get(contract.canonicalKey);
    if (!entry) {
      return [this.formatRequiredRouteFailure(contract.canonicalKey, [], 'reconciliation-entry-missing')];
    }

    if (entry.executionOutcome === 'applied' || entry.executionOutcome === 'noop') {
      return [];
    }

    return [this.formatRequiredRouteFailure(contract.canonicalKey, entry.reasons, entry.executionOutcome)];
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

  private isRuntimeParameterizedContract(contract: ResolvedPluginDefaultPageContract): boolean {
    return contract.materializationMode === 'singleton-document' && this.hasPathParameters(contract.effectiveSlug);
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
