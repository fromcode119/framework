import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ProjectPaths } from '@core/config/paths';

/**
 * A stamp for a theme's BUILT assets, derived from the files themselves.
 *
 * The frontend inlines the active theme's CSS through a cached fetch and version-busts that URL. Stamping
 * it with the theme's `version` looked right and was not: a version is a number someone edits, so a theme
 * rebuilt at the same version keeps the same URL, and the cached copy of the OLD css is served until the
 * entry ages out. That shipped — a fixed stylesheet stayed invisible through a full rebuild and repeated
 * restarts of both containers, with the corrected file sitting on disk in each of them.
 *
 * So the stamp is taken from what actually changed: each asset's size and mtime. Rebuild the theme and the
 * URL moves; leave it alone and the URL is stable, so the cache still does its job. This is the same
 * reasoning `FrontendAssetVersionUrlService` already applies one level down — a manifest cannot be trusted
 * to track its own package, and the runtime does not have to ask it to.
 *
 * `stat` only, never a read: these are the theme's largest files and the payload this feeds is built on
 * every storefront render.
 */
export class ThemeAssetFingerprintService {
  /**
   * A short digest of every declared asset that exists on disk, or `''` when none can be resolved —
   * a missing themes dir or an unreadable file yields NO stamp rather than an invented one, and the
   * caller falls back to the theme version it would have used anyway.
   */
  static forThemeAssets(slug: string, relativeAssetPaths: string[]): string {
    const resolvedSlug = String(slug || '').trim();
    if (!resolvedSlug) return '';

    const uiDir = path.join(ProjectPaths.getThemesDir(), resolvedSlug, 'ui');
    const parts: string[] = [];

    for (const relativePath of relativeAssetPaths) {
      const asset = String(relativePath || '').trim();
      // An absolute URL is somebody else's asset (a font CDN) — it has no mtime here and no bearing on
      // whether THIS theme was rebuilt.
      if (!asset || asset.startsWith('http')) continue;

      const absolute = path.resolve(uiDir, asset);
      // A declared path must not climb out of the theme's own ui dir.
      if (!absolute.startsWith(path.resolve(uiDir))) continue;

      try {
        const stats = fs.statSync(absolute);
        parts.push(`${asset}:${stats.size}:${Math.round(stats.mtimeMs)}`);
      } catch {
        /* not on disk — contributes nothing, and never a placeholder */
      }
    }

    if (parts.length === 0) return '';
    return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 12);
  }
}
