import { ApplicationUrlUtils, AttentionResolutionService, CoreServices, HostResourceService, InstallationChecklistService, RecentEditsService, SiteBaseUrl, SystemConstants, TenantMode, PluginTenantAccess, AdminScope } from '@fromcode119/core';
import { Request, Response } from 'express';
import { SecretService } from '@fromcode119/core';
import { SystemControllerRuntime } from '@api/controllers/system/system-controller-runtime';

/**
 * What ONE SITE looks like right now: its content counts, its recent edits, what is installed on it.
 *
 * Every answer here is bound to the tenant the request carries, never to a site named in a parameter.
 * That is the difference between an operator reading their own site and an operator reading somebody
 * else's, and it is enforced by reading the binding rather than trusting the caller.
 *
 * Split out of `SystemAdminController`, which answers for the PLATFORM — totals across every site,
 * the schedule, the health of the deployment. The two were one controller because both are read by
 * the same dashboard, not because they answer the same question.
 */
export class SystemSiteOverviewController {
  /** How far back "is this site healthy" looks. A day, so a nightly failure is still visible. */
  private static readonly SITE_HEALTH_WINDOW_MS = 24 * 60 * 60 * 1000;

  constructor(
    private readonly runtime: SystemControllerRuntime,
  ) {}

  /**
   * One row per site: its host, the theme actually serving it, and whether anything has gone wrong
   * there today. Traffic, orders and revenue are NOT here — those belong to whichever plugin owns
   * them, and a site with no commerce must show nothing rather than a zero that claims it sold none.
   */
  async getSiteStats(req: Request, res: Response) {
    try {
      // THE SITES OVERVIEW IS THE OPERATOR'S. `_system_tenants` is not tenant-scoped — it is the table
      // that DEFINES the tenants, so row-level security cannot help here — and this handler sits
      // behind `system:view`, which a site's own administrator holds. Unfiltered it handed any site
      // admin the platform's entire customer roster: every slug, every PRIMARY HOSTNAME, each one's
      // state, visibility and active theme. A hostname names the customer, so this was the most
      // directly identifying listing on the box.
      //
      // Bound to a site, the answer is that site's own row. In platform scope it is every site, which
      // is the dashboard this screen exists to be.
      const boundTenantId = String((req as any).tenantId || '').trim();
      const scopedWhere = TenantMode.isEnabled() && boundTenantId ? { where: { id: boundTenantId } } : {};
      const tenants = await this.runtime.db.find(SystemConstants.TABLE.TENANTS, { limit: 100, ...scopedWhere });
      const themes = await this.runtime.db.find(SystemConstants.TABLE.TENANT_THEMES, { where: { state: 'active' }, limit: 200 });
      const themeByTenant = new Map<string, any>((themes || []).map((row: any) => [String(row.tenant_id), row]));
      const since = new Date(Date.now() - SystemSiteOverviewController.SITE_HEALTH_WINDOW_MS).toISOString();

      const sites = await Promise.all((tenants || []).map(async (tenant: any) => ({
        id: String(tenant.id),
        slug: String(tenant.slug || ''),
        host: String(tenant.primary_host || ''),
        state: String(tenant.state || ''),
        kind: String(tenant.kind || ''),
        // Read straight off the row. A blank means a row written before the column existed; the
        // closed answer is the honest one to show, matching the column default.
        visibility: String(tenant.visibility || 'private'),
        themeSlug: String(themeByTenant.get(String(tenant.id))?.theme_slug || ''),
        errors24h: await this.countSiteErrors(String(tenant.id), since),
      })));

      res.json({ sites });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** A site with no tenant-scoped log rows simply has no errors; a failed count must not read as 0. */
  private async countSiteErrors(tenantId: string, since: string): Promise<number | null> {
    try {
      return await this.runtime.db.count(SystemConstants.TABLE.LOGS, {
        where: { level: 'ERROR', tenant_id: tenantId, created_at: { gte: since } },
      });
    } catch {
      return null;
    }
  }

  /** Enough to pick up where you left off; more is a history page, which exists elsewhere. */
  private static readonly RECENT_EDITS_LIMIT = 5;

  /**
   * The documents THIS operator last edited, from the version history the framework already writes.
   * Scoped to the caller: "recently changed by anyone" is the activity log's question, and merging
   * the two buries your own work under a colleague's import.
   */
  async getRecentEdits(req: Request, res: Response) {
    try {
      const service = new RecentEditsService({
        findVersions: (limit: number) => this.runtime.db.find(SystemConstants.TABLE.RECORD_VERSIONS, {
          orderBy: { updated_at: 'desc' },
          limit,
        }),
        listCollections: () => this.runtime.manager.getCollections() as any[],
      });
      const userId = String((req as any)?.user?.id ?? '');
      res.json({ edits: await service.list(userId, SystemSiteOverviewController.RECENT_EDITS_LIMIT) });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * What this installation has and has not got yet — the dashboard's fresh-install face reads it to
   * decide whether to show onboarding or the working board, and renders the same list either way.
   */
  /**
   * The installation checklist, and WHOSE installation it describes.
   *
   * Every count here is the container's: how many sites exist, how many accounts, what is installed
   * on the box. The route is guarded by `system:view`, which a SITE's own administrator holds — so a
   * customer's admin was told how many other customers this platform has and how many accounts exist
   * in total. That is the same permission, and the same class of leak, as the sites roster.
   *
   * Inside a site the counts are that SITE's, and the container-level facts are omitted rather than
   * scoped: "how many sites are on this box" and "is this deployment multi-site" have no per-site
   * answer, and inventing one would be worse than leaving them out. The platform scope is unchanged.
   */
  async getInstallation(req: Request, res: Response) {
    try {
      const tenantId = this.boundTenantId(req);
      if (tenantId) return res.json(await this.siteInstallation(tenantId));

      const service = new InstallationChecklistService({
        countThemes: () => (this.runtime.themeManager.getThemes() || []).length,
        activeThemeName: () => String(this.runtime.themeManager.getActiveThemeManifest()?.name || ''),
        storefrontUrl: () => ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.FRONTEND_APP),
        countSites: () => this.runtime.db.count(SystemConstants.TABLE.TENANTS),
        // Bundled extensions ship with the framework, so they say nothing about whether anyone has
        // started using this installation — counting them made a brand-new box claim it was in use.
        countPlugins: () => (this.runtime.manager.getPlugins() || [])
          .filter((plugin: any) => plugin?.manifest?.bundled !== true).length,
        countUsers: () => this.runtime.db.count(SystemConstants.TABLE.USERS),
        canStoreSecrets: () => SecretService.isEncryptionAvailable(),
        readMeta: async (key: string) => {
          const row = await this.runtime.db.findOne(SystemConstants.TABLE.META, { key });
          return String(row?.value ?? '').trim();
        },
      });
      // `scope` is stamped on BOTH branches, not just the site one. The dashboard heads its activity
      // card with it, and a missing value there is not "platform" — it is "we don't know", which is
      // the one thing the card must not present as either.
      res.json({ ...await service.read(), scope: AdminScope.PLATFORM });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** The site this request is bound to, or '' in the platform scope. Same idiom as the sweeps above. */
  boundTenantId(req: Request): string {
    if (!TenantMode.isEnabled()) return '';
    return String((req as any).tenantId || '').trim();
  }

  /**
   * The checklist for ONE site: what IT has, counted from the rows that record what belongs to it.
   *
   * No `sites` count and no `mode` — those describe the container, not a site. `isFresh` keeps its
   * meaning: a site with no theme and no plugins of its own is one nobody has started using.
   */
  private async siteInstallation(tenantId: string): Promise<Record<string, unknown>> {
    const rowsFor = async (table: string): Promise<any[]> => {
      const rows = await this.runtime.db.find(table, { where: { tenant_id: tenantId } }).catch(() => []);
      return Array.isArray(rows) ? rows : [];
    };

    const [themeRows, pluginRows, memberRows, storefront] = await Promise.all([
      rowsFor(SystemConstants.TABLE.TENANT_THEMES),
      rowsFor(SystemConstants.TABLE.TENANT_PLUGINS),
      rowsFor(SystemConstants.TABLE.TENANT_MEMBERSHIPS),
      // The SITE's own address. The deployment's configured frontend URL is the platform's host, and
      // printing it here told a site operator their site was served somewhere it is not. When the
      // site's address cannot be resolved the answer is blank, and the dashboard says nothing.
      SiteBaseUrl.forSite(tenantId, ApplicationUrlUtils.FRONTEND_APP),
    ]);
    const themes = themeRows.length;
    const plugins = pluginRows.length;
    const activeTheme = String(themeRows.find((row: any) => String(row?.state ?? '') === 'active')?.theme_slug ?? '');

    return {
      isFresh: themes === 0 && plugins === 0,
      counts: { themes, plugins, users: memberRows.length },
      storefront,
      // The same steps the platform checklist lists, counted for THIS site. Without them a fresh
      // site's dashboard was a "finish setting up" heading over an empty list.
      steps: InstallationChecklistService.setupSteps({ activeTheme, themes, plugins, site: true }),
      scope: AdminScope.SITE,
    };
  }

  /**
   * The security summary as ONE site sees it.
   *
   * The container-level facts are REMOVED rather than filtered, because they have no per-site
   * version: the running plugin processes and the host's memory describe the box every customer
   * shares. What remains is recomputed over this site's own plugins, so the counts and the slug
   * lists describe what this site runs and nothing else.
   *
   * `integrityEnforced` / `signatureEnforced` stay: they are booleans about the environment this
   * site runs in, carrying no other customer's data, and a site operator reading "plugins here must
   * be signed" is being told something true about their own runtime.
   */
  securitySummaryForSite(summary: any, tenantId: string): Record<string, unknown> {
    const enabled = PluginTenantAccess.enabledSlugsFor(tenantId);
    const mine = (this.runtime.manager.getPlugins() || [])
      .filter((plugin: any) => enabled.has(String(plugin?.manifest?.slug ?? '')));
    const isSandboxed = (plugin: any) => plugin?.manifest?.sandbox !== false;
    const active = mine.filter((plugin: any) => String(plugin?.state ?? '') === 'active');
    const mismatch = active.filter(isSandboxed).filter((plugin: any) => !plugin?.isSandboxed);
    const slugsOf = (list: any[]) => list.map((plugin: any) => String(plugin?.manifest?.slug ?? ''));

    return {
      monitor: summary?.monitor,
      pluginIsolation: {
        totalPlugins: mine.length,
        activePlugins: active.length,
        sandboxConfiguredPlugins: mine.filter(isSandboxed).length,
        sandboxActivePlugins: active.filter(isSandboxed).length,
        sandboxRuntimeActivePlugins: active.filter((plugin: any) => !!plugin?.isSandboxed).length,
        sandboxPolicyRuntimeMismatchPlugins: mismatch.length,
        sandboxPolicyRuntimeMismatchSlugs: slugsOf(mismatch),
        unsandboxedActivePlugins: active.filter((plugin: any) => !isSandboxed(plugin)).length,
        unsandboxedActivePluginSlugs: slugsOf(active.filter((plugin: any) => !isSandboxed(plugin))),
      },
      integrityEnforced: summary?.integrityEnforced,
      signatureEnforced: summary?.signatureEnforced,
      scope: AdminScope.SITE,
    };
  }
}
