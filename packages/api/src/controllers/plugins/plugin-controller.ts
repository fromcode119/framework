import { Request, Response } from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ArchiveUploadSessionService, BackupService, PluginManager, Logger, SafeArchive } from '@fromcode119/core';
import { CoercionUtils } from '@fromcode119/core';
import { PluginInstallOperationService } from '../../services/plugin-install-operation-service';

export class PluginController {
  private static readonly PRODUCTION_ASSET_CACHE_HEADER = 'public, max-age=2592000';

  private static readonly ALLOWED_ARCHIVE_EXTENSIONS = ['.zip', '.tar.gz', '.tgz'];

  private logger = new Logger({ namespace: 'plugin-controller' });
  private operations = PluginInstallOperationService.getInstance();

  constructor(private manager: PluginManager) {}

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
    this.logger.info(`Installation request received for plugin: ${slug}`);

    try {
      const marketplacePlugin = await this.manager.marketplace.getPluginInfo(slug);
      if (!marketplacePlugin) {
        return res.status(404).json({ error: `Plugin "${slug}" not found in marketplace.` });
      }

      const operation = this.operations.start(slug, 'marketplace install', async (reportProgress) => {
        await this.manager.installOrUpdateFromMarketplace(slug, {
          enable: true,
          progressReporter: reportProgress,
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

  async upload(req: any, res: Response) {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    try {
      const detachedArchivePath = this.createDetachedArchiveCopy(req.file.path, req.file.originalname);
      const operation = this.operations.start('upload', 'archive install', async (reportProgress) => {
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
      const info = await this.inspectPluginArchive(req.file.path, req.file.originalname);
      res.json({ success: true, info });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Invalid plugin archive' });
    } finally {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    }
  }

  async startUploadSession(req: Request, res: Response) {
    try {
      const payload = this.readUploadSessionRequest(req.body);
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
      const payload = this.readChunkUploadRequest(req);
      const result = ArchiveUploadSessionService.appendChunk(payload.uploadId, payload.filePath, payload.chunkIndex, payload.totalChunks);
      res.status(201).json({ success: true, ...result });
    } catch (err: any) {
      res.status(err?.statusCode || 400).json({ error: err.message || 'Could not upload plugin package chunk.' });
    }
  }

  async inspectStagedUpload(req: Request, res: Response) {
    try {
      const uploadId = this.readUploadId(req.body);
      const uploadedArchive = ArchiveUploadSessionService.resolveUploadedArchive(uploadId);
      const info = await this.inspectPluginArchive(uploadedArchive.filePath, uploadedArchive.originalFilename);
      res.json({ success: true, uploadId, info });
    } catch (err: any) {
      res.status(err?.statusCode || 400).json({ error: err.message || 'Invalid plugin archive' });
    }
  }

  async completeStagedUpload(req: Request, res: Response) {
    let uploadId = '';
    try {
      uploadId = this.readUploadId(req.body);
      const uploadedArchive = ArchiveUploadSessionService.resolveUploadedArchive(uploadId);
      const detachedArchivePath = this.createDetachedArchiveCopy(uploadedArchive.filePath, uploadedArchive.originalFilename);
      const operation = this.operations.start('upload', 'archive install', async (reportProgress) => {
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
    const { slug } = req.params;
    const plugin = this.manager.getPlugins().find(p => p.manifest.slug === slug);
    if (!plugin || !plugin.path || plugin.state !== 'active') {
      return res.status(404).json({ error: 'Not found or disabled' });
    }

    const filePath = (req.params as any)[0];
    const abs = path.resolve(plugin.path, 'ui', filePath);
    if (!abs.startsWith(path.resolve(plugin.path, 'ui'))) {
      return res.status(400).json({ error: 'Invalid path' });
    }

    if (fs.existsSync(abs)) {
      if (process.env.NODE_ENV !== 'production') {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        return res.sendFile(abs);
      } else {
        return res.sendFile(abs, {
          headers: {
            'Cache-Control': PluginController.PRODUCTION_ASSET_CACHE_HEADER,
          },
        });
      }
    }

    return res.status(404).json({ error: 'Asset not found' });
  }

  private async inspectPluginArchive(filePath: string, originalFilename?: string) {
    const extractedDir = await this.extractArchiveToTemporaryDirectory(filePath, originalFilename, 'plugin');
    try {
      const manifestPath = this.findManifestPath(extractedDir, 'manifest.json');
      if (!manifestPath) {
        throw new Error('Invalid plugin package: manifest.json not found.');
      }

      let manifest: any;
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      } catch {
        throw new Error('Invalid plugin package: manifest.json is not valid JSON.');
      }

      const slug = String(manifest?.slug || '').trim().toLowerCase();
      if (!slug) {
        throw new Error('Invalid plugin package: missing "slug" in manifest.json.');
      }

      const existing = this.manager.getPlugins().find((plugin: any) => plugin?.manifest?.slug === slug);

      return {
        slug,
        name: String(manifest?.name || slug),
        version: String(manifest?.version || ''),
        description: String(manifest?.description || ''),
        author: String(manifest?.author || ''),
        files: this.countFiles(extractedDir),
        dependencies: this.formatDependencyMap(manifest?.dependencies),
        peerDependencies: this.formatDependencyMap(manifest?.peerDependencies),
        hasUiBundle: this.directoryContainsSegment(extractedDir, 'ui'),
        hasServerCode: this.directoryContainsFilePattern(extractedDir, /(^|\/)index\.(js|ts)$/i),
        existingVersion: existing?.manifest?.version || null,
        action: existing ? 'update' : 'install',
      };
    } finally {
      fs.rmSync(extractedDir, { recursive: true, force: true });
    }
  }

  private async extractArchiveToTemporaryDirectory(filePath: string, originalFilename: string | undefined, type: 'plugin' | 'theme'): Promise<string> {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `fromcode-${type}-inspect-`));
    try {
      if (this.isZipArchive(filePath, originalFilename)) {
        SafeArchive.extractZip(filePath, tempDir);
      } else if (this.isTarArchive(filePath, originalFilename)) {
        await BackupService.restore(filePath, tempDir);
      } else {
        throw new Error(`Unsupported archive format. Upload a .zip or .tar.gz ${type} package.`);
      }
      return tempDir;
    } catch (error) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      throw error;
    }
  }

  private findManifestPath(rootDir: string, filename: string): string | null {
    const directPath = path.join(rootDir, filename);
    if (fs.existsSync(directPath)) {
      return directPath;
    }

    for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      const found = this.findManifestPath(path.join(rootDir, entry.name), filename);
      if (found) {
        return found;
      }
    }

    return null;
  }

  private directoryContainsSegment(rootDir: string, segment: string): boolean {
    for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
      const absolutePath = path.join(rootDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === segment || this.directoryContainsSegment(absolutePath, segment)) {
          return true;
        }
      }
    }
    return false;
  }

  private directoryContainsFilePattern(rootDir: string, pattern: RegExp): boolean {
    for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
      const absolutePath = path.join(rootDir, entry.name);
      if (entry.isDirectory()) {
        if (this.directoryContainsFilePattern(absolutePath, pattern)) {
          return true;
        }
        continue;
      }

      const normalizedPath = absolutePath.replace(/\\/g, '/');
      if (pattern.test(normalizedPath)) {
        return true;
      }
    }
    return false;
  }

  private countFiles(rootDir: string): number {
    let count = 0;
    for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
      const absolutePath = path.join(rootDir, entry.name);
      if (entry.isDirectory()) {
        count += this.countFiles(absolutePath);
      } else if (entry.isFile()) {
        count += 1;
      }
    }
    return count;
  }

  private formatDependencyMap(value: unknown): string[] {
    if (!value || typeof value !== 'object') {
      return [];
    }
    return Object.entries(value as Record<string, unknown>)
      .map(([dependency, version]) => {
        const normalizedDependency = String(dependency || '').trim();
        const normalizedVersion = String(version || '').trim();
        if (!normalizedDependency) {
          return '';
        }
        return normalizedVersion ? `${normalizedDependency} (${normalizedVersion})` : normalizedDependency;
      })
      .filter(Boolean);
  }

  private createDetachedArchiveCopy(sourceFilePath: string, originalFilename?: string): string {
    const extension = path.extname(String(originalFilename || sourceFilePath || '').trim()) || '.bin';
    const detachedPath = path.join(os.tmpdir(), `fromcode-plugin-install-${Date.now()}-${Math.random().toString(16).slice(2)}${extension}`);
    fs.copyFileSync(sourceFilePath, detachedPath);
    return detachedPath;
  }

  private readUploadSessionRequest(body: unknown): { originalFilename: string; totalSizeBytes: number; totalChunks: number } {
    if (!body || typeof body !== 'object') {
      throw new Error('Upload session payload is required.');
    }
    const originalFilename = String((body as { originalFilename?: unknown }).originalFilename || '').trim();
    const totalSizeBytes = Number((body as { totalSizeBytes?: unknown }).totalSizeBytes || 0);
    const totalChunks = Number((body as { totalChunks?: unknown }).totalChunks || 0);
    if (!originalFilename) {
      throw new Error('originalFilename is required.');
    }
    if (!Number.isFinite(totalSizeBytes) || totalSizeBytes <= 0) {
      throw new Error('totalSizeBytes must be greater than zero.');
    }
    if (!Number.isInteger(totalChunks) || totalChunks <= 0) {
      throw new Error('totalChunks must be a positive integer.');
    }
    return { originalFilename, totalSizeBytes, totalChunks };
  }

  private readChunkUploadRequest(req: Request): { uploadId: string; filePath: string; chunkIndex: number; totalChunks: number } {
    const uploadRequest = req as Request & {
      file?: { path?: unknown };
      body?: { uploadId?: unknown; chunkIndex?: unknown; totalChunks?: unknown };
    };
    const uploadId = String(uploadRequest.body?.uploadId || '').trim();
    const filePath = String(uploadRequest.file?.path || '').trim();
    const chunkIndex = Number(uploadRequest.body?.chunkIndex || -1);
    const totalChunks = Number(uploadRequest.body?.totalChunks || 0);
    if (!uploadId) {
      throw new Error('uploadId is required.');
    }
    if (!filePath) {
      throw new Error('chunk file is required.');
    }
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
      throw new Error('chunkIndex must be a non-negative integer.');
    }
    if (!Number.isInteger(totalChunks) || totalChunks <= 0) {
      throw new Error('totalChunks must be a positive integer.');
    }
    return { uploadId, filePath, chunkIndex, totalChunks };
  }

  private readUploadId(body: unknown): string {
    const uploadId = String((body as { uploadId?: unknown } | null | undefined)?.uploadId || '').trim();
    if (!uploadId) {
      throw new Error('uploadId is required.');
    }
    return uploadId;
  }

  private isZipArchive(filePath: string, originalFilename?: string): boolean {
    const normalizedOriginalName = String(originalFilename || '').trim().toLowerCase();
    if (normalizedOriginalName.endsWith('.zip')) {
      return true;
    }

    try {
      const header = fs.readFileSync(filePath).subarray(0, 4);
      return header.length >= 2 && header[0] === 0x50 && header[1] === 0x4b;
    } catch {
      return false;
    }
  }

  private isTarArchive(filePath: string, originalFilename?: string): boolean {
    const normalizedOriginalName = String(originalFilename || '').trim().toLowerCase();
    return normalizedOriginalName.endsWith('.tar.gz') || normalizedOriginalName.endsWith('.tgz') || normalizedOriginalName.endsWith('.tar') || !this.isZipArchive(filePath, originalFilename);
  }
}
