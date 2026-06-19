import { Request, Response } from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { BackupService, ThemeManager, SafeArchive } from '@fromcode119/core';
import { ApplicationHostUtils } from '@fromcode119/core';
import { ArchiveUploadRequestParser } from '../archive-upload-request-parser';

/**
 * Archive inspection/extraction, upload-request parsing, asset serving and
 * dependency formatting for theme packages. Extracted from ThemeController to
 * keep each file under the size limit; ThemeController instantiates this with
 * the same ThemeManager and delegates, so behavior is unchanged.
 */
export class ThemeArchiveSupport {
  private static readonly PRODUCTION_ASSET_CACHE_HEADER = 'public, max-age=2592000';

  private static readonly COMPRESSIBLE_MIME: Record<string, string> = {
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.html': 'text/html',
  };

  constructor(private manager: ThemeManager) {}

  serveAssetDirectory(req: Request, res: Response, directory: 'public' | 'ui') {
    const { slug } = req.params;
    const theme = this.manager.getThemes().find(t => t.slug === slug);
    if (!theme) return res.status(404).end();

    const requestedPath = String((req.params as any)[0] || '').trim();
    if (!requestedPath) {
      return res.status(404).end();
    }

    const themeDir = this.manager.getThemeDirectory(slug);
    const assetRoot = path.resolve(themeDir, directory);
    const absolutePath = path.resolve(assetRoot, requestedPath);

    if (!absolutePath.startsWith(`${assetRoot}${path.sep}`) && absolutePath !== assetRoot) {
      return res.status(404).end();
    }

    if (fs.existsSync(absolutePath)) {
      const noCache = this.shouldDisableAssetCache(req);
      const ext = path.extname(absolutePath).toLowerCase();
      const mimeType = ThemeArchiveSupport.COMPRESSIBLE_MIME[ext];
      const gzPath = absolutePath + '.gz';
      const acceptsGzip = String(req.headers['accept-encoding'] || '').includes('gzip');

      if (mimeType && acceptsGzip && fs.existsSync(gzPath)) {
        const headers: Record<string, string> = {
          'Content-Encoding': 'gzip',
          'Content-Type': mimeType,
          'Vary': 'Accept-Encoding',
          'Cache-Control': noCache ? 'no-store, no-cache, must-revalidate, proxy-revalidate' : ThemeArchiveSupport.PRODUCTION_ASSET_CACHE_HEADER,
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
        res.sendFile(absolutePath);
      } else {
        res.sendFile(absolutePath, {
          headers: {
            'Cache-Control': ThemeArchiveSupport.PRODUCTION_ASSET_CACHE_HEADER,
          },
        });
      }
      return;
    }

    res.status(404).end();
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

  async inspectThemeArchive(filePath: string, originalFilename?: string) {
    const extractedDir = await this.extractArchiveToTemporaryDirectory(filePath, originalFilename);
    try {
      const themeEntry = this.findManifestPath(extractedDir, 'theme.json');
      if (!themeEntry) {
        throw new Error('Invalid theme package: theme.json not found.');
      }

      let manifest: any;
      try {
        manifest = JSON.parse(fs.readFileSync(themeEntry, 'utf8'));
      } catch {
        throw new Error('Invalid theme package: theme.json is not valid JSON.');
      }

      const slug = String(manifest?.slug || '').trim().toLowerCase();
      if (!slug) {
        throw new Error('Invalid theme package: missing "slug" in theme.json.');
      }

      const existing = this.manager.getThemes().find((theme: any) => theme?.slug === slug);
      const themeRoot = path.dirname(themeEntry);
      const bundledEntries = this.collectBundledPluginArchives(themeRoot).map((archivePath) => ({
        name: path.relative(themeRoot, archivePath).replace(/\\/g, '/'),
        size: fs.statSync(archivePath).size,
      }));

      return {
        slug,
        name: String(manifest?.name || slug),
        version: String(manifest?.version || ''),
        description: String(manifest?.description || ''),
        author: String(manifest?.author || ''),
        dependencies: this.formatDependencyMap(manifest?.dependencies),
        hasUiBundle: this.directoryContainsSegment(themeRoot, 'ui'),
        bundledPlugins: bundledEntries,
        existingVersion: existing?.version || null,
        action: existing ? 'update' : 'install',
      };
    } finally {
      fs.rmSync(extractedDir, { recursive: true, force: true });
    }
  }

  private async extractArchiveToTemporaryDirectory(filePath: string, originalFilename?: string): Promise<string> {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fromcode-theme-inspect-'));
    try {
      if (this.isZipArchive(filePath, originalFilename)) {
        SafeArchive.extractZip(filePath, tempDir);
      } else if (this.isTarArchive(filePath, originalFilename)) {
        await BackupService.restore(filePath, tempDir);
      } else {
        throw new Error('Unsupported archive format. Upload a .zip or .tar.gz theme package.');
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

  private collectBundledPluginArchives(rootDir: string): string[] {
    const results: string[] = [];
    for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) {
        continue;
      }
      const absolutePath = path.join(rootDir, entry.name);
      if (entry.isDirectory()) {
        results.push(...this.collectBundledPluginArchives(absolutePath));
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const normalized = absolutePath.replace(/\\/g, '/').toLowerCase();
      const isBundledDirectory = normalized.includes('/plugins/') || normalized.includes('/bundled-plugins/');
      const isArchive = normalized.endsWith('.zip') || normalized.endsWith('.tar.gz') || normalized.endsWith('.tgz');
      if (isBundledDirectory && isArchive) {
        results.push(absolutePath);
      }
    }
    return results;
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
