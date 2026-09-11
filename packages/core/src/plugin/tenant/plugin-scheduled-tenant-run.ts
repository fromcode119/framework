import { Logger } from '@core/logging';
import { RequestContextUtils } from '@core/context/request-context';
import { PluginTenantAccess } from '@core/plugin/tenant/plugin-tenant-access';
import { TenantMode } from '@core/tenant/tenant-mode';
import { TenantResolverService } from '@core/tenant/tenant-resolver-service';

/**
 * Runs a plugin's SCHEDULED task once per tenant, so a timer can reach tenant data at all.
 *
 * A scheduled task has no request, and therefore no tenant. `UntenantedBootAccess` sees exactly
 * that — no request store — and skips the query rather than widening it to every tenant, which is
 * the correct refusal but leaves the task running and reading nothing. The visible result was a
 * per-source "Build automatically" toggle that fired on time, found zero sources, and could never
 * do the thing it offered: a control that cannot keep its promise.
 *
 * The fix belongs here rather than in any plugin. Every plugin with a timer has the same problem,
 * and eleven copies of this is eleven places to get tenant isolation subtly wrong.
 *
 * What it does NOT do is run for tenants that do not have the plugin, and it does not run for
 * suspended ones. A handler failing for one tenant does not stop the rest — a single customer's bad
 * data must not silently halt everyone else's scheduled work — but each failure is logged against
 * the tenant it belongs to, because "the nightly task is failing" is unactionable without knowing
 * whose.
 *
 * Tenants are processed SEQUENTIALLY and each tenant's connection scope is closed before the next
 * opens. Overlapping them would hold several tenant-bound pool clients at once, which is how the
 * pool wedges when a handler waits on anything out-of-process.
 */
export class PluginScheduledTenantRun {
  private static readonly logger = new Logger({ namespace: 'plugin-tenancy' });

  /**
   * Wraps a handler so it is tenant-aware, or returns it untouched on a single-tenant deployment.
   *
   * The decision is made per RUN, not at registration: `TenantMode` is settled at boot, but reading
   * it here keeps the wrapper honest if that ever changes, and costs a boolean.
   */
  static wrap(input: {
    pluginSlug: string;
    taskName: string;
    db: { withTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T>; find(table: string, options: unknown): Promise<unknown> };
    handler: (data?: unknown) => unknown | Promise<unknown>;
  }): (data?: unknown) => Promise<void> {
    return async (data?: unknown): Promise<void> => {
      if (!TenantMode.isEnabled()) {
        await input.handler(data);
        return;
      }
      await PluginScheduledTenantRun.runForEveryTenant(input, data);
    };
  }

  private static async runForEveryTenant(
    input: Parameters<typeof PluginScheduledTenantRun.wrap>[0],
    data: unknown,
  ): Promise<void> {
    const label = `${input.pluginSlug}:${input.taskName}`;
    const tenants = await TenantResolverService.shared(input.db).listActive();
    let ran = 0;

    for (const tenant of tenants) {
      if (!(await PluginTenantAccess.isPresentFor(input.pluginSlug, tenant.id))) continue;
      ran += (await PluginScheduledTenantRun.runForTenant(input, data, tenant.id, label)) ? 1 : 0;
    }

    PluginScheduledTenantRun.logger.debug(
      `"${label}" ran for ${ran} of ${tenants.length} tenant(s).`,
    );
  }

  /**
   * One tenant's turn.
   *
   * Both scopes are needed and they do different jobs: the request store is what stops the tenancy
   * guard skipping the query, and `withTenant` is what binds the connection so row-level security
   * answers for this tenant. With only the first, the query runs unbound and reads whatever the
   * policy lets through; with only the second, it never runs at all.
   */
  private static async runForTenant(
    input: Parameters<typeof PluginScheduledTenantRun.wrap>[0],
    data: unknown,
    tenantId: string,
    label: string,
  ): Promise<boolean> {
    try {
      await PluginTenantAccess.warm(tenantId);
      await RequestContextUtils.storage.run(
        { tenantId },
        () => input.db.withTenant(tenantId, async () => { await input.handler(data); }),
      );
      return true;
    } catch (error: unknown) {
      PluginScheduledTenantRun.logger.error(
        `Scheduled task "${label}" failed for tenant "${tenantId}"`,
        error,
      );
      return false;
    }
  }
}
