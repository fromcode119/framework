import { Request, Response } from 'express';
import fs from 'fs';
import { ArchiveUploadSessionService, BaseController, PluginManager, Logger, CoercionUtils } from '@fromcode119/core';
import { PluginInstallOperationService } from '../../services/plugin-install-operation-service';
import { PluginArchiveSupport } from './plugin-archive-support';

export class PluginController extends BaseController {
  private static readonly ALLOWED_ARCHIVE_EXTENSIONS = ['.zip', '.tar.gz', '.tgz'];

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

    res.json(this.manager.getSortedPlugins().map(p => ({
      manifest: p.manifest,
      state: p.state,
      path: p.path,
      error: p.error,
      approvedCapabilities: p.approvedCapabilities,
      healthStatus: p.healthStatus || 'healthy'
    })));
  }

  async active(req: Request, res: Response) {
    const activePlugins = this.manager.getSortedPlugins(
      this.manager.getPlugins().filter(p => p.state === 'active')
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

  async toggle(req: Request, res: Response) {
    const { slug } = req.params;
    const { enabled, force, recursive } = req.body;
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

  async getConfig(req: Request, res: Response) {
    const { slug } = req.params;
    const plugin = this.manager.getPlugins().find(p => p.manifest.slug === slug);
    if (!plugin) return res.status(404).json({ error: 'Plugin not found' });
    res.json(plugin.manifest.config || {});
  }

  async saveConfig(req: Request, res: Response) {
    const { slug } = req.params;
    try {
      await this.manager.savePluginConfig(slug, req.body);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async saveSandboxConfig(req: Request, res: Response) {
    const { slug } = req.params;
    try {
      await (this.manager as any).saveSandboxConfig(slug, req.body);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async delete(req: Request, res: Response) {
    const { slug } = req.params;
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
    const { slug } = req.params;
    const requestedVersion = String(req.query.version || '').trim();
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

  async installOperation(req: Request, res: Response) {
    const operation = this.operations.get(String(req.params.operationId || ''));
    if (!operation) {
      return res.status(404).json({ error: 'Plugin install operation not found.' });
    }

    res.json({ success: true, operation });
  }

  async logs(req: Request, res: Response) {
    const { slug } = req.params;
    const db = (this.manager as any).db;
    const { systemLogs } = require('@fromcode119/database');
    try {
      const logs = await db.find(systemLogs, {
        where: db.eq(systemLogs.pluginSlug, slug),
        orderBy: db.desc(systemLogs.timestamp),
        limit: 100
      });
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
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
