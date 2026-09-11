import { Request, Response } from 'express';
import fs from 'fs';
import { BaseController, PluginManager, Logger, CoercionUtils, PluginHealthReportService, PluginRegistryHealth, PluginState, PluginTenantAccess, SystemConstants, TenantMode } from '@fromcode119/core';
import { PluginInstallOperationService } from '@api/services/plugin-install-operation-service';
import { PluginArchiveSupport } from '@api/controllers/plugins/plugin-archive-support';
import { PlatformAccessResolver } from '@api/services/request/platform-access-resolver';

export class PluginController extends BaseController {

  /** Newest lines only — the detail page shows a tail, not the whole ledger. */
  private static readonly LOG_PAGE_SIZE = 100;

  private logger = new Logger({ namespace: 'plugin-controller' });
  private operations = PluginInstallOperationService.getInstance();
  private archiveSupport: PluginArchiveSupport;

  constructor(private manager: PluginManager) {
    super();
    this.archiveSupport = new PluginArchiveSupport(manager);
  }

  async list(req: Request, res: Response) {
    const shouldRefresh = CoercionUtils.toBoolean(req.query.refresh);

    if (shouldRefresh) {
      try {
        await this.manager.discoverPlugins();
      } catch (err: any) {
        this.logger.error(`Plugin discovery refresh failed: ${err.message}`);
      }
    }

    // TWO AXES, reported separately and never collapsed into one word.
    //
    //   state             — the PLATFORM axis: installed, loadable, healthy, not held. Only an
    //                       operator with platform access can change it.
    //   enabledForTenant  — the TENANT axis: does the site currently open in the admin run it.
    //
    // Collapsing them would make "held for an integrity failure" indistinguishable from "this
    // customer does not pay for it", which are opposite problems with opposite fixes.
    const tenantId = String((req as any).tenantId || '').trim();
    const enabledSlugs = TenantMode.isEnabled() && tenantId
      ? PluginTenantAccess.enabledSlugsFor(tenantId)
      : null;

    // A tenant admin sees what its OWN site runs — not the platform's catalogue. Twenty-five
    // installed products, several of them other customers', is exactly the inventory a customer must
    // not be able to read off a shared box. A platform admin sees everything, because it is the one
    // deciding what each site gets.
    const access = new PlatformAccessResolver((this.manager as any).schemaDb ?? this.manager.db);
    const platformAdmin = await access.isPlatformAdmin(req);
    /**
     * Bundled extensions are NOT on this list.
     *
     * They ship inside the image as framework surface — always active, not installable, not
     * removable — so listing them here presented the framework's own screens as somebody's plugin,
     * counted them in "1 total / 1 active", and offered an enable toggle and a delete button that
     * the lifecycle refuses. A control that cannot do what it says is worse than no control.
     *
     * The admin METADATA endpoint still carries them, which is what puts their screens in the
     * navigation; this endpoint answers "what did an operator install", and the answer excludes
     * what came with the framework.
     */
    const visible = this.manager.getSortedPlugins()
      .filter((p) => p.manifest?.bundled !== true)
      .filter((p) => platformAdmin || !enabledSlugs || enabledSlugs.has(p.manifest.slug));

    res.json(visible.map(p => ({
      manifest: p.manifest,
      state: p.state,
      path: p.path,
      error: p.error,
      approvedCapabilities: p.approvedCapabilities,
      healthStatus: p.healthStatus || PluginRegistryHealth.HEALTHY,
      heldReason: p.heldReason,
      multiTenant: TenantMode.isEnabled(),
      // `null` on a single-tenant deployment: not "false", because there is no per-site axis there
      // and a false would render a switch that means nothing.
      enabledForTenant: enabledSlugs ? enabledSlugs.has(p.manifest.slug) : null,
      // T5: WHERE the plugin's code runs. `isolated` = its own process (pid when up); `shared` = the
      // api process, with the reason the plugin declared for staying there.
      isolation: p.isSandboxed ? 'isolated' : 'shared',
      isolationReason: PluginController.isolationReason(p),
      isolationPid: p.isSandboxed ? ((this.manager as any).pluginHosts?.get(p.manifest.slug)?.pid ?? null) : null,
    })));
  }

  /** The reason a plugin declared for running in the api process, or the platform default when it declared none. */
  private static isolationReason(p: { isSandboxed?: boolean; manifest: { sandbox?: unknown } }): string | null {
    if (p.isSandboxed) return null;
    const sandbox = p.manifest.sandbox;
    if (sandbox && typeof sandbox === 'object' && typeof (sandbox as { reason?: unknown }).reason === 'string') return String((sandbox as { reason: string }).reason);
    if (sandbox === false || (sandbox && typeof sandbox === 'object' && (sandbox as { enabled?: unknown }).enabled === false)) return 'The plugin declares sandbox: false.';
    return 'The platform default is "shared" (Settings → Infrastructure → Plugin Isolation).';
  }

  async active(req: Request, res: Response) {
    const activePlugins = this.manager.getSortedPlugins(
      this.manager.getPlugins().filter(p => p.state === PluginState.ACTIVE)
    ).map(p => ({
        slug: p.manifest.slug,
        version: p.manifest.version,
        name: p.manifest.name,
        capabilities: p.manifest.capabilities,
        ui: {
          ...(p.manifest.ui || {}),
          headInjections: this.manager.getHeadInjections(p.manifest.slug)
        }
      }));
    res.json(activePlugins);
  }

  async health(_req: Request, res: Response) {
    const report = PluginHealthReportService.buildReport(
      this.manager.getPlugins().map((p) => ({
        slug: p.manifest.slug,
        state: p.state,
        healthStatus: p.healthStatus,
        heldReason: p.heldReason,
        error: p.error,
        manifestCapabilities: (p.manifest.capabilities as string[]) || [],
        approvedCapabilities: p.approvedCapabilities || [],
      })),
    );
    res.json(report);
  }

  async getConfig(req: Request, res: Response) {
    const slug = CoercionUtils.toString(req.params.slug);
    const plugin = this.manager.getPlugins().find(p => p.manifest.slug === slug);
    if (!plugin) return res.status(404).json({ error: 'Plugin not found' });
    res.json(plugin.manifest.config || {});
  }

  async saveConfig(req: Request, res: Response) {
    const slug = CoercionUtils.toString(req.params.slug);
    try {
      await this.manager.savePluginConfig(slug, req.body);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async saveSandboxConfig(req: Request, res: Response) {
    const slug = CoercionUtils.toString(req.params.slug);
    try {
      await (this.manager as any).saveSandboxConfig(slug, req.body);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async marketplace(req: Request, res: Response) {
    try {
      const plugins = await this.manager.marketplace.fetchCatalog();
      res.json({ plugins });
    } catch (err: any) {
      this.logger.error(`Marketplace error: ${err.message}`);
      res.status(503).json({
        error: 'Marketplace currently unavailable.',
        message: err.message
      });
    }
  }

  async install(req: Request, res: Response) {
    const slug = CoercionUtils.toString(req.params.slug);
    const requestedVersion = CoercionUtils.toString(req.query?.version);
    this.logger.info(`Installation request received for plugin: ${slug}`);

    try {
      const marketplacePlugin = await this.manager.marketplace.getPluginInfo(slug, requestedVersion);
      if (!marketplacePlugin) {
        return res.status(404).json({ error: `Plugin "${slug}"${requestedVersion ? ` v${requestedVersion}` : ''} not found in marketplace.` });
      }

      const operation = this.operations.start(slug, 'marketplace install', async (reportProgress) => {
        await this.manager.installOrUpdateFromMarketplace(slug, {
          enable: true,
          progressReporter: reportProgress,
          version: requestedVersion || undefined,
        });
      });

      res.status(202).json({
        success: true,
        operationId: operation.id,
        dependencies: Object.keys(marketplacePlugin.dependencies || {}),
      });
    } catch (err: any) {
      this.logger.error(`Failed to install plugin ${slug}: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Batch update: every installed plugin with a newer marketplace version, ONE operation, ONE API
   * restart at the end (the per-plugin install path restarts per replace — N updates cost N
   * restarts, which is exactly what this endpoint exists to avoid).
   */
  async updateAll(_req: Request, res: Response) {
    try {
      const operation = this.operations.start('all', 'marketplace update-all', async (reportProgress) => {
        const result = await this.manager.updateAllFromMarketplace({ progressReporter: reportProgress });
        if (result.failed.length && !result.updated.length) {
          throw new Error(`Every update failed: ${result.failed.map((f) => `${f.slug} (${f.error})`).join('; ')}`);
        }
      });
      res.status(202).json({ success: true, operationId: operation.id });
    } catch (err: any) {
      this.logger.error(`Failed to start batch plugin update: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  }

  async installOperation(req: Request, res: Response) {
    const operation = this.operations.get(CoercionUtils.toString(req.params.operationId));
    if (!operation) {
      return res.status(404).json({ error: 'Plugin install operation not found.' });
    }

    res.json({ success: true, operation });
  }

  /**
   * Recent log lines for one plugin.
   *
   * This was written against a Drizzle-style API the manager does not have: `systemLogs` is a static
   * MEMBER of the schema class, so `require('@fromcode119/database').systemLogs` was `undefined` and
   * every request 500'd with "Cannot read properties of undefined (reading 'pluginSlug')" — which is
   * why the plugin detail page could never show logs. It now reads the table the same way every other
   * system controller does. Framework internals use the raw manager, so the column is snake_case here.
   */
  async logs(req: Request, res: Response) {
    const slug = CoercionUtils.toString(req.params?.slug);
    if (!slug) {
      return res.status(400).json({ error: 'Plugin slug is required.' });
    }

    try {
      const db = (this.manager as any).db;
      const logs = await db.find(SystemConstants.TABLE.LOGS, {
        where: { plugin_slug: slug },
        orderBy: { timestamp: 'desc' },
        limit: PluginController.LOG_PAGE_SIZE,
      });
      res.json(Array.isArray(logs) ? logs : []);
    } catch (err: any) {
      this.logger?.error?.(`Failed to read logs for plugin "${slug}": ${err?.message}`);
      res.status(500).json({ error: err?.message ?? 'Failed to read plugin logs.' });
    }
  }

  async serveAssets(req: Request, res: Response) {
    return this.archiveSupport.serveAssets(req, res);
  }
}
