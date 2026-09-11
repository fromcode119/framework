import { PerTenantRun } from '@core/tenant/per-tenant-run';
import { RequestContextUtils } from '@core/context/request-context';
import { TenantMode } from '@core/tenant/tenant-mode';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';

/**
 * `context.tenants` — how a plugin does work that belongs to every site.
 *
 * It exists because there was no way to do it. A plugin's `onInit` runs at BOOT, where there is no
 * request and therefore no tenant, and every tenant-scoped query made there is skipped by the
 * tenancy guard (a read) or refused by row-level security (a write). The plugin sees a warning in a
 * log it does not read and its one-off normalisation, backfill or default silently never happens —
 * for any site. That was the only outcome available: the framework had no tenancy surface at all,
 * so "do this for each site" could not be expressed, only got wrong.
 *
 * Inside a REQUEST none of this applies: there is exactly one tenant, `current()` names it, and a
 * plugin should just do the work.
 */
export class TenantsContextProxy {
  static createTenantsProxy(manager: IPluginManagerInterface, pluginSlug: string) {
    return {
      /**
       * Runs `work` once for every site, each inside that site's own scope.
       *
       * Use it for boot-time work that touches this plugin's tables: a backfill, a default row, a
       * one-off normalisation. Inside a request it runs once, for the current site, because that is
       * the only site the request is about.
       *
       * A site whose run throws is logged against its own id and does not stop the others: one
       * customer's bad data must not halt every other customer's boot.
       *
       * Returns how many sites it ran for, so a caller can say so rather than assume.
       */
      forEach: async (work: () => Promise<void>): Promise<number> => PerTenantRun.forEach({
        label: `${pluginSlug}:tenants.forEach`,
        db: manager.db as never,
        work,
      }),

      /**
       * The site this code is running for, or null outside a request (boot, a timer, a job).
       *
       * ASYNC even though the answer is known synchronously here. An isolated plugin runs in its own
       * process and has to ask the host, so a synchronous version would be a string in one world and
       * a Promise in the other — the shape of bug that had a plugin log success for a call that had
       * failed. One signature, both worlds.
       */
      current: async (): Promise<string | null> => RequestContextUtils.getTenantId() ?? null,

      /**
       * Whether this deployment serves more than one site.
       *
       * For a plugin deciding whether work is worth fanning out — NOT for deciding whether to scope
       * a query. Scoping is the framework's job and happens whether or not a plugin asks.
       */
      isMultiSite: async (): Promise<boolean> => TenantMode.isEnabled(),
    };
  }
}
