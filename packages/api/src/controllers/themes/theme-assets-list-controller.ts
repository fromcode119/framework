import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { ThemeManager, Logger, ApiPathUtils } from '@fromcode119/core';
import { ApiUrlUtils } from '../../utils/url';
import type { ThemeAssetEntry, ThemeAssetsListResponse } from './theme-assets-list-controller.interfaces';

const IMAGE_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
};

const VIDEO_MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
};

const SCANNED_SUBDIRS = ['images', 'videos'];

export class ThemeAssetsListController {
  private logger = new Logger({ namespace: 'theme-assets-list-controller' });

  constructor(private themeManager: ThemeManager) {}

  listActiveThemeAssets = async (req: Request, res: Response): Promise<void> => {
    try {
      const manifest = this.themeManager.getActiveThemeManifest();
      const themeSlug = String(manifest?.slug || '').trim() || null;
      if (!themeSlug) {
        res.json({ themeSlug: null, assets: [] } satisfies ThemeAssetsListResponse);
        return;
      }

      const themeDir = this.themeManager.getThemeDirectory(themeSlug);
      const uiRoot = path.resolve(themeDir, 'ui');

      const assets: ThemeAssetEntry[] = [];
      for (const subdir of SCANNED_SUBDIRS) {
        const absoluteSubdir = path.join(uiRoot, subdir);
        if (!this.isDirectory(absoluteSubdir)) continue;
        this.walk(absoluteSubdir, subdir, themeSlug, req, assets);
      }
      assets.sort((left, right) => left.relativePath.localeCompare(right.relativePath));

      res.json({ themeSlug, assets } satisfies ThemeAssetsListResponse);
    } catch (err: any) {
      this.logger.error(`Failed to list theme assets: ${err?.message || err}`);
      res.status(500).json({ error: err?.message || 'Failed to list theme assets' });
    }
  };

  private walk(
    absoluteDir: string,
    relativeDir: string,
    themeSlug: string,
    req: Request,
    out: ThemeAssetEntry[],
  ): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
    } catch { return; }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const absoluteChild = path.join(absoluteDir, entry.name);
      const relativeChild = path.posix.join(relativeDir, entry.name);
      if (entry.isDirectory()) {
        this.walk(absoluteChild, relativeChild, themeSlug, req, out);
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      const mimeType = IMAGE_MIME[ext] || VIDEO_MIME[ext];
      if (!mimeType) continue;
      const url = ApiUrlUtils.resolvePublicUrl(req, ApiPathUtils.themeUiAssetPath(themeSlug, relativeChild));
      out.push({ filename: entry.name, relativePath: relativeChild, mimeType, url });
    }
  }

  private isDirectory(candidate: string): boolean {
    try { return fs.existsSync(candidate) && fs.statSync(candidate).isDirectory(); }
    catch { return false; }
  }
}
