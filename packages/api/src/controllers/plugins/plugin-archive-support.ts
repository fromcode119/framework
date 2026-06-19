import { Request, Response } from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { BackupService, PluginManager, SafeArchive } from '@fromcode119/core';
import { ApplicationHostUtils } from '@fromcode119/core';
import { ArchiveUploadRequestParser } from '../archive-upload-request-parser';

/**
 * Archive inspection/extraction, upload-request parsing, asset serving and
 * dependency formatting for plugin packages. Extracted from PluginController to
 * keep each file under the size limit; PluginController instantiates this with
 * the same PluginManager and delegates, so behavior is unchanged.
 */
export class PluginArchiveSupport {
  private static readonly PRODUCTION_ASSET_CACHE_HEADER = 'public, max-age=2592000';

  private static readonly COMPRESSIBLE_MIME: Record<string, string> = {
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.html': 'text/html',
  };

  constructor(private manager: PluginManager) {}

  serveAssets(req: Request, res: Response) {
    const { slug } = req.params;
    const plugin = this.manager.getPlugins().find(p => p.manifest.slug === slug);
    if (!plugin || !plugin.path || plugin.state !== 'active') {
      return res.status(404).json({ error: 'Not found or disabled' });
    }

    const filePath = (req.params as any)[0];
    const abs = path.resolve(plugin.path, 'src', 'ui', filePath);
    if (!abs.startsWith(path.resolve(plugin.path, 'src', 'ui'))) {
      return res.status(400).json({ error: 'Invalid path' });
    }

    if (fs.existsSync(abs)) {
      const noCache = this.shouldDisableAssetCache(req);
      const ext = path.extname(abs).toLowerCase();
      const mimeType = PluginArchiveSupport.COMPRESSIBLE_MIME[ext];
      const gzPath = abs + '.gz';
      const acceptsGzip = String(req.headers['accept-encoding'] || '').includes('gzip');

      if (mimeType && acceptsGzip && fs.existsSync(gzPath)) {
        const headers: Record<string, string> = {
          'Content-Encoding': 'gzip',
          'Content-Type': mimeType,
          'Vary': 'Accept-Encoding',
          'Cache-Control': noCache ? 'no-store, no-cache, must-revalidate, proxy-revalidate' : PluginArchiveSupport.PRODUCTION_ASSET_CACHE_HEADER,
        };
        if (noCache) {
          headers['Pragma'] = 'no-cache';
          headers['Expires'] = '0';
        }
        res.set(headers);
        return res.sendFile(gzPath);
      }

      if (noCache) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        return res.sendFile(abs);
      }
      return res.sendFile(abs, {
        headers: { 'Cache-Control': PluginArchiveSupport.PRODUCTION_ASSET_CACHE_HEADER },
      });
    }

    return res.status(404).json({ error: 'Asset not found' });
  }

  private shouldDisableAssetCache(req: Request): boolean {
    if (process.env.NODE_ENV !== 'production') {
      return true;
    }

    const configuredUrls = [
      process.env.API_URL,
      process.env.FRONTEND_URL,
      process.env.ADMIN_URL,
      process.env.MARKETPLACE_URL,
    ]
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean);
    if (configuredUrls.some((value) => ApplicationHostUtils.isLocalDevelopmentHostname(value))) {
      return true;
    }

    const host = String(req.get('host') || req.get('x-forwarded-host') || '').trim().toLowerCase();
    return ApplicationHostUtils.isLocalDevelopmentHostname(host);
  }

  async inspectPluginArchive(filePath: string, originalFilename?: string) {
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

  createDetachedArchiveCopy(sourceFilePath: string, originalFilename?: string): string {
    const extension = path.extname(String(originalFilename || sourceFilePath || '').trim()) || '.bin';
    const detachedPath = path.join(os.tmpdir(), `fromcode-plugin-install-${Date.now()}-${Math.random().toString(16).slice(2)}${extension}`);
    fs.copyFileSync(sourceFilePath, detachedPath);
    return detachedPath;
  }

  readUploadSessionRequest(body: unknown): { originalFilename: string; totalSizeBytes: number; totalChunks: number } {
    return ArchiveUploadRequestParser.readUploadSessionRequest(body);
  }

  readChunkUploadRequest(req: Request): { uploadId: string; filePath: string; chunkIndex: number; totalChunks: number } {
    return ArchiveUploadRequestParser.readChunkUploadRequest(req);
  }

  readUploadId(body: unknown): string {
    return ArchiveUploadRequestParser.readUploadId(body);
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
