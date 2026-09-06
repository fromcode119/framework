/**
 * Is this deployment multi-tenant, and is it allowed to be?
 *
 * A deployment with NO rows in `_system_tenants` is single-tenant: it behaves exactly as it did
 * before tenancy existed — no tenant is resolved, no tenant predicate is injected, no connection is
 * bound. That is not a convenience. Every existing installation has an empty tenant table, so
 * without this the tenancy layer would refuse every request on every deployment that has not been
 * migrated yet.
 *
 * The mode is deployment-wide, not per-request, so it lives in a process-level flag rather than the
 * async request context. Turning a deployment multi-tenant (adding the first tenant) therefore needs
 * a restart — which is correct: it also re-runs the boot check below.
 */
export class TenantMode {
  private static enabled = false;
  private static isolationSupported = false;
  private static dialect = '';

  /**
   * Decided once at boot. `tenantCount` comes from `_system_tenants`; `isolationSupported` is
   * whether this dialect actually has a tenant isolation strategy.
   *
   * A multi-tenant deployment on a dialect that cannot isolate is a HARD FAILURE, not a warning.
   * The alternative is serving several customers out of one database with nothing separating them —
   * which looks completely healthy right up until one of them reads another's data.
   */
  static configure(input: { tenantCount: number; dialect: string; isolationSupported: boolean }): void {
    TenantMode.enabled = input.tenantCount > 0;
    TenantMode.dialect = String(input.dialect || '');
    TenantMode.isolationSupported = input.isolationSupported === true;

    if (TenantMode.enabled && !TenantMode.isolationSupported) {
      throw new Error(
        `TenantMode: this deployment has ${input.tenantCount} tenant(s), but the "${TenantMode.dialect}" `
        + 'driver has no tenant isolation strategy. Refusing to boot — serving multiple tenants from a '
        + 'driver that cannot separate them would expose every tenant to every other tenant, with no '
        + 'symptom. Use a driver with an isolation strategy, or remove the tenant rows to run '
        + 'single-tenant.',
      );
    }
  }

  /** True only when tenants are actually configured. Single-tenant deployments answer false. */
  static isEnabled(): boolean {
    return TenantMode.enabled;
  }

  /** Test seam — resets the process flag. */
  static reset(): void {
    TenantMode.enabled = false;
    TenantMode.isolationSupported = false;
    TenantMode.dialect = '';
  }
}
