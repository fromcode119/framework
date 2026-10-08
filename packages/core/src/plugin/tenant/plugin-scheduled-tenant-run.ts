import { Logger } from '@core/logging';
import { PluginTenantAccess } from '@core/plugin/tenant/plugin-tenant-access';
import { TenantMode } from '@core/tenant/tenant-mode';
import { PerTenantRun } from '@core/tenant/per-tenant-run';
import { RequestContextUtils } from '@core/context/request-context';

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
 * Each site's run reads in that site's own language, as a request that names none does: its localized
 * fields come back in that language and `context.i18n.currentLocale()` names it. A run used to have no
 * reading language at all, so a localized value came back in whichever language its map held first.
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
    await PerTenantRun.forEach({
      label: `${input.pluginSlug}:${input.taskName}`,
      db: input.db,
      // "Has the plugin" means installed by them OR shipped by the framework: a bundled extension is
      // in nobody's installed set, and gating on that alone ran the Sources task for zero tenants.
      appliesTo: async (tenantId, tenant) => {
        if (!(await PluginTenantAccess.isPresentFor(input.pluginSlug, tenantId))) return false;
        // A non-production site runs no scheduled work at all. The other two brakes (email and
        // `context.fetch`) would catch most of what a task tries to DO, but not all of it — a task
        // that only writes rows still moves a copy's state on its own, which makes the copy diverge
        // from the original it is meant to mirror. Skipping the tenant is the honest answer.
        if (!tenant.environment.isProduction) {
          PluginScheduledTenantRun.logger.info(
            `Skipping ${input.pluginSlug}:${input.taskName} for "${tenant.slug}" — the site is marked non-production.`,
          );
          return false;
        }
        return true;
      },
      before: (tenantId) => PluginTenantAccess.warm(tenantId),
      work: async () => {
        PluginScheduledTenantRun.readInSiteLanguage();
        await input.handler(data);
      },
    });
  }

  /** The run's reading language: the site's own, unless the run already reads in one. */
  private static readInSiteLanguage(): void {
    const store = RequestContextUtils.storage.getStore();
    const siteLocale = RequestContextUtils.getSiteLocale();
    if (store && !store.locale && siteLocale) store.locale = siteLocale;
  }
}
