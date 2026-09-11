import { Logger } from '@core/logging';
import { RequestContextUtils } from '@core/context/request-context';
import { TenantMode } from '@core/tenant/tenant-mode';
import { TenantResolverService } from '@core/tenant/tenant-resolver-service';

/**
 * Runs work once per tenant, for the paths that have no request to borrow a tenant from.
 *
 * Boot and timers are the two of them, and both were silently broken in the same way. A scheduled
 * task fired and read nothing. The framework's own `seedDefaults` for person catalogs failed with
 * "new row violates row-level security policy", as did every plugin registering a catalog of its own
 * — so on a multi-tenant deployment those defaults existed only for whichever tenant happened to
 * trigger the code inside a request.
 *
 * Two scopes are needed and they do different jobs: the request store is what stops the tenancy guard
 * SKIPPING a query, and `withTenant` is what binds the connection so row-level security ACCEPTS it.
 * With only the first, writes are refused by the policy; with only the second, reads never run.
 *
 * Sequential, one scope closed before the next opens: holding several tenant-bound pool clients at
 * once is how the pool wedges when the work waits on anything out-of-process.
 */
export class PerTenantRun {
  private static readonly logger = new Logger({ namespace: 'tenancy' });

  /**
   * Runs `work` for every active tenant, or exactly once on a single-tenant deployment.
   *
   * `appliesTo` filters, for callers whose work belongs only to some tenants. A tenant whose run
   * throws is logged against its own id and does not stop the others: one customer's bad data must
   * not silently halt everyone else's.
   */
  static async forEach(input: {
    label: string;
    db: { withTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> };
    work: () => Promise<void>;
    appliesTo?: (tenantId: string) => Promise<boolean>;
    before?: (tenantId: string) => Promise<void>;
  }): Promise<number> {
    if (!TenantMode.isEnabled()) {
      await input.work();
      return 1;
    }

    const tenants = await TenantResolverService.shared(input.db).listActive();
    let ran = 0;

    for (const tenant of tenants) {
      if (input.appliesTo && !(await input.appliesTo(tenant.id))) continue;
      ran += (await PerTenantRun.runOne(input, tenant.id)) ? 1 : 0;
    }

    PerTenantRun.logger.debug(`"${input.label}" ran for ${ran} of ${tenants.length} tenant(s).`);
    return ran;
  }

  private static async runOne(
    input: Parameters<typeof PerTenantRun.forEach>[0],
    tenantId: string,
  ): Promise<boolean> {
    try {
      if (input.before) await input.before(tenantId);
      await RequestContextUtils.storage.run(
        { tenantId },
        () => input.db.withTenant(tenantId, async () => { await input.work(); }),
      );
      return true;
    } catch (error: unknown) {
      PerTenantRun.logger.error(`"${input.label}" failed for tenant "${tenantId}"`, error);
      return false;
    }
  }
}
