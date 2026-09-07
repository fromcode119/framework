import { Request, Response } from 'express';
import fs from 'fs';
import { ArchiveUploadSessionService, BaseController, PluginManager, Logger, CoercionUtils, PluginHealthReportService, PluginRegistryHealth, PluginState, PluginTenantAccess, PluginTenantStateService, SystemConstants, TenantMembershipService, TenantMode } from '@fromcode119/core';
import { PluginInstallOperationService } from '@api/services/plugin-install-operation-service';
import { PluginArchiveSupport } from '@api/controllers/plugins/plugin-archive-support';
import { PlatformAccessResolver } from '@api/services/request/platform-access-resolver';

export class PluginController extends BaseController {
  private static readonly ALLOWED_ARCHIVE_EXTENSIONS = ['.zip', '.tar.gz', '.tgz'];

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
    const visible = this.manager.getSortedPlugins().filter((p) =>
      platformAdmin || !enabledSlugs || enabledSlugs.has(p.manifest.slug));

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

  /**
   * Turn a plugin on or off.
   *
   * ON A MULTI-TENANT DEPLOYMENT THIS IS A PER-TENANT ACTION. `_system_plugins` records installation
   * — one container, one filesystem, one copy of the code — and a tenant cannot install code, only
   * turn on code the operator already installed. So the toggle writes the tenant's enablement row
   * and touches the platform state not at all.
   *
   * No restart, and nothing is loaded or unloaded: the route/hook/namespace gates are consulted per
   * request, so invalidating the cache is the whole deployment step.
   */
  async toggle(req: Request, res: Response) {
    const slug = CoercionUtils.toString(req.params.slug);
    const { enabled, force, recursive } = req.body;

    // `scope: 'platform'` is the operator-wide axis — is this plugin loadable AT ALL. It is a
    // platform-admin action and is refused for anyone else, because one customer must never be able
    // to take a plugin down for every other customer. Everything else on a multi-tenant deployment
    // means "for the site I am currently in".
    const platformScope = String((req.body as any)?.scope || '').trim() === 'platform';

    if (TenantMode.isEnabled() && !platformScope) {
      return this.toggleForTenant(req, res, String(slug), CoercionUtils.toBoolean(enabled) === true);
    }

    if (TenantMode.isEnabled() && platformScope) {
      const memberships = new TenantMembershipService((this.manager as any).schemaDb ?? this.manager.db);
      const isPlatformAdmin = await memberships.isPlatformAdminAccount(String((req as any).user?.id ?? ''));
      if (!isPlatformAdmin) {
        return res.status(403).json({ error: 'platform_admin_required' });
      }
      // Falls through to the platform path below, and every tenant's cached answer is dropped:
      // taking a plugin off the platform axis must not leave a tenant's gate saying yes.
      PluginTenantAccess.invalidate();
    }

    try {
      if (enabled) {
        await this.manager.enable(slug, {
          force: CoercionUtils.toBoolean(force),
          recursive: CoercionUtils.toBoolean(recursive)
        });
      } else {
        await this.manager.disable(slug);
      }
      res.json({ success: true, state: enabled ? 'active' : 'inactive' });
    } catch (err: any) {
      if (err.message.startsWith('DEPENDENCY_ISSUES:')) {
        try {
          const json = err.message.replace('DEPENDENCY_ISSUES: ', '');
          const issues = JSON.parse(json);
          return res.status(409).json({
            code: 'DEPENDENCY_REQUIRED',
            message: 'One or more required plugins are missing or inactive.',
            issues,
            plugin: slug
          });
        } catch (e) {}
      }

      const status = err.message.toLowerCase().includes('not found') ||
                     err.message.toLowerCase().includes('missing dependency') ||
                     err.message.toLowerCase().includes('incompatible') ? 400 : 500;
      this.logger.error(`Toggle failed for plugin "${slug}": ${err.message}`);
      res.status(status).json({ error: err.message });
    }
  }

  /**
   * The per-tenant half of `toggle`.
   *
   * A plugin that is not loadable at all (missing, or held for an integrity failure) cannot be
   * enabled for anyone — the two axes are independent and neither overrides the other. Saying so
   * here, rather than writing a row that the gate will refuse anyway, is the difference between an
   * operator seeing "this plugin is broken" and seeing a switch that turns on and does nothing.
   */
  private async toggleForTenant(req: Request, res: Response, slug: string, enabled: boolean) {
    const tenantId = String((req as any).tenantId || '').trim();
    if (!tenantId) {
      return res.status(400).json({ error: 'no_tenant_selected' });
    }

    const plugin = this.manager.plugins.get(slug);
    if (!plugin) {
      return res.status(404).json({ error: `Plugin "${slug}" is not installed on this platform.` });
    }
    if (enabled && plugin.state !== PluginState.ACTIVE) {
      return res.status(409).json({
        code: 'PLUGIN_NOT_AVAILABLE',
        error: `Plugin "${slug}" is installed but not available on this platform`
          + `${plugin.heldReason ? ` (${plugin.heldReason})` : ''}. It cannot be enabled for a site `
          + 'until that is resolved.',
      });
    }

    const service = new PluginTenantStateService((this.manager as any).schemaDb ?? this.manager.db);
    try {
      if (enabled) await service.enable(tenantId, slug);
      else await service.disable(tenantId, slug);
      return res.json({ success: true, tenantId, state: enabled ? 'active' : 'inactive' });
    } catch (err: any) {
      this.logger.error(`Tenant toggle failed for plugin "${slug}" on tenant "${tenantId}": ${err?.message}`);
      return res.status(500).json({ error: err?.message || String(err) });
    }
  }

  /** Re-approve + enable every plugin currently held on the warning axis (capability drift).
   *  enable() advances approvedCapabilities to the current manifest, so the hold clears. */
  async reapproveAll(_req: Request, res: Response) {
    const held = this.manager.getPlugins().filter(
      (p) => p.healthStatus === PluginRegistryHealth.WARNING || Boolean(p.heldReason),
    );
    const results: Array<{ slug: string; ok: boolean; error?: string }> = [];
    for (const p of held) {
      const slug = p.manifest.slug;
      try {
        await this.manager.enable(slug, { force: false, recursive: false });
        results.push({ slug, ok: true });
      } catch (err: any) {
        results.push({ slug, ok: false, error: err?.message || String(err) });
      }
    }
    res.json({ success: results.every((r) => r.ok), reapproved: results });
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

  async delete(req: Request, res: Response) {
    const slug = CoercionUtils.toString(req.params.slug);
    try {
      await this.manager.delete(slug);
      res.json({ success: true });
    } catch (err: any) {
      const isValidationError = err.message.toLowerCase().includes('cannot delete') ||
                               err.message.toLowerCase().includes('required by') ||
                               err.message.toLowerCase().includes('not found');

      const status = isValidationError ? 400 : 500;
      this.logger.error(`Delete failed for plugin "${slug}": ${err.message}`);
      res.status(status).json({ error: err.message });
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

  private startArchiveInstallOperation(detachedArchivePath: string) {
    return this.operations.start('upload', 'archive install', async (reportProgress) => {
      try {
        await this.manager.installUploadedPluginArchive(detachedArchivePath, {
          enable: true,
          progressReporter: reportProgress,
        });
      } finally {
        if (fs.existsSync(detachedArchivePath)) {
          fs.unlinkSync(detachedArchivePath);
        }
      }
    });
  }

  async upload(req: any, res: Response) {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    try {
      const detachedArchivePath = this.archiveSupport.createDetachedArchiveCopy(req.file.path, req.file.originalname);
      const operation = this.startArchiveInstallOperation(detachedArchivePath);
      res.status(202).json({ success: true, operationId: operation.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    } finally {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    }
  }

  async inspectUpload(req: any, res: Response) {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    try {
      const info = await this.archiveSupport.inspectPluginArchive(req.file.path, req.file.originalname);
      res.json({ success: true, info });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Invalid plugin archive' });
    } finally {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    }
  }

  async startUploadSession(req: Request, res: Response) {
    try {
      const payload = this.archiveSupport.readUploadSessionRequest(req.body);
      res.status(201).json({
        success: true,
        ...ArchiveUploadSessionService.startSession(
          payload.originalFilename,
          payload.totalSizeBytes,
          payload.totalChunks,
          PluginController.ALLOWED_ARCHIVE_EXTENSIONS,
        ),
      });
    } catch (err: any) {
      res.status(err?.statusCode || 400).json({ error: err.message || 'Could not start upload session.' });
    }
  }

  async uploadChunk(req: any, res: Response) {
    try {
      const payload = this.archiveSupport.readChunkUploadRequest(req);
      const result = ArchiveUploadSessionService.appendChunk(payload.uploadId, payload.filePath, payload.chunkIndex, payload.totalChunks);
      res.status(201).json({ success: true, ...result });
    } catch (err: any) {
      res.status(err?.statusCode || 400).json({ error: err.message || 'Could not upload plugin package chunk.' });
    }
  }

  async inspectStagedUpload(req: Request, res: Response) {
    try {
      const uploadId = this.archiveSupport.readUploadId(req.body);
      const uploadedArchive = ArchiveUploadSessionService.resolveUploadedArchive(uploadId);
      const info = await this.archiveSupport.inspectPluginArchive(uploadedArchive.filePath, uploadedArchive.originalFilename);
      res.json({ success: true, uploadId, info });
    } catch (err: any) {
      res.status(err?.statusCode || 400).json({ error: err.message || 'Invalid plugin archive' });
    }
  }

  async completeStagedUpload(req: Request, res: Response) {
    let uploadId = '';
    try {
      uploadId = this.archiveSupport.readUploadId(req.body);
      const uploadedArchive = ArchiveUploadSessionService.resolveUploadedArchive(uploadId);
      const detachedArchivePath = this.archiveSupport.createDetachedArchiveCopy(uploadedArchive.filePath, uploadedArchive.originalFilename);
      const operation = this.startArchiveInstallOperation(detachedArchivePath);
      res.status(202).json({ success: true, operationId: operation.id });
    } catch (err: any) {
      res.status(err?.statusCode || 500).json({ error: err.message || 'Could not install plugin package.' });
    } finally {
      if (uploadId) {
        ArchiveUploadSessionService.discardSession(uploadId);
      }
    }
  }

  async serveAssets(req: Request, res: Response) {
    return this.archiveSupport.serveAssets(req, res);
  }
}
