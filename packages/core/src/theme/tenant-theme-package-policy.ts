import fs from 'fs';
import path from 'path';
import type { IThemeManifest } from '@core/theme/interfaces/theme-manifest.interface';

/**
 * What a SITE is allowed to put in a theme it uploads.
 *
 * The platform's own themes are curated: an operator built or reviewed them, and they may carry
 * server code, database seeds and bundled plugins because someone decided to trust them. A site's
 * upload is none of those things, and the difference is not a matter of degree:
 *
 *   A theme's `ui-ssr/entry.mjs` is loaded by a native `import()` INSIDE the Next.js frontend
 *   process. No vm, no worker, no module policy. Server code in an uploaded theme would therefore
 *   be arbitrary Node running with the frontend's full privileges — for every tenant on the box,
 *   not just the one who uploaded it.
 *
 * There is no cheap way to contain that, so an uploaded theme carries NO SERVER CODE AT ALL. What
 * survives is `theme.json` plus `ui/**` and `public/**`: files the visitor's browser fetches. A bad
 * one then breaks that site's own pages and nothing else, which is the property this whole policy
 * exists to buy.
 *
 * REFUSED, NOT STRIPPED. Quietly deleting half an uploaded package and reporting success would leave
 * an operator staring at a theme that renders wrong with nothing saying why — the magic this codebase
 * is not allowed to have. The upload fails and names every reason.
 */
export class TenantThemePackagePolicy {

  /** Directories that only ever hold code the platform would run, rather than files a browser fetches. */
  private static readonly FORBIDDEN_DIRS = ['ui-ssr', 'plugins', 'bundled-plugins', 'node_modules'] as const;

  /** Manifest keys that ask the platform to DO something at install time, rather than describing the theme. */
  private static readonly FORBIDDEN_MANIFEST_KEYS = ['bundledPlugins', 'dependencies', 'seeds'] as const;

  /** Native addons are machine code; nothing about a browser-rendered theme needs one. */
  private static readonly FORBIDDEN_EXTENSIONS = ['.node'] as const;

  /**
   * Every reason this package may not be installed for a site. Empty means it may.
   *
   * Collected rather than thrown one at a time, so an uploader fixing their package sees the whole
   * list instead of discovering it one failed upload at a time.
   */
  static violations(contentDir: string, manifest: IThemeManifest): string[] {
    return [
      ...TenantThemePackagePolicy.forbiddenDirViolations(contentDir),
      ...TenantThemePackagePolicy.manifestViolations(manifest),
      ...TenantThemePackagePolicy.fileViolations(contentDir),
    ];
  }

  private static forbiddenDirViolations(contentDir: string): string[] {
    const found: string[] = [];
    for (const name of TenantThemePackagePolicy.FORBIDDEN_DIRS) {
      if (!fs.existsSync(path.join(contentDir, name))) continue;
      found.push(
        name === 'ui-ssr'
          ? 'contains "ui-ssr/" — a site\'s theme renders in the browser only, so it carries no server code.'
          : `contains "${name}/", which a site's theme may not ship.`,
      );
    }
    return found;
  }

  private static manifestViolations(manifest: IThemeManifest): string[] {
    const found: string[] = [];
    for (const key of TenantThemePackagePolicy.FORBIDDEN_MANIFEST_KEYS) {
      const value = (manifest as unknown as Record<string, unknown>)[key];
      if (value === undefined || value === null) continue;
      if (Array.isArray(value) && value.length === 0) continue;
      if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) continue;
      if (typeof value === 'string' && !value.trim()) continue;
      found.push(
        key === 'seeds'
          ? 'declares "seeds" — installing a site\'s theme writes no rows to the database.'
          : `declares "${key}", which installs code onto the platform; a site's theme may not.`,
      );
    }
    return found;
  }

  /**
   * Walks the package for files that are not browser content.
   *
   * SYMLINKS ARE REFUSED ANYWHERE, including ones that resolve inside the package. The archive
   * extractor already blocks traversal on the way in, and this is the second question: a link that is
   * innocent at install time still points wherever it points when the asset route later reads through
   * it, and "themes/tenants/acme/x/logo.png -> /app/.env" is a file the browser would be served.
   */
  private static fileViolations(contentDir: string): string[] {
    const found: string[] = [];
    const walk = (dir: string, relative: string): void => {
      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        found.push(`could not be read at "${relative || '.'}".`);
        return;
      }
      for (const entry of entries) {
        const entryRelative = relative ? path.join(relative, entry.name) : entry.name;
        if (entry.isSymbolicLink()) {
          found.push(`contains a symbolic link at "${entryRelative}"; an uploaded theme is plain files.`);
          continue;
        }
        if (entry.isDirectory()) {
          walk(path.join(dir, entry.name), entryRelative);
          continue;
        }
        const extension = path.extname(entry.name).toLowerCase();
        if ((TenantThemePackagePolicy.FORBIDDEN_EXTENSIONS as readonly string[]).includes(extension)) {
          found.push(`contains a native binary at "${entryRelative}".`);
        }
      }
    };
    walk(contentDir, '');
    return found;
  }

  /** Total size of the package on disk, for the quota the caller enforces. Symlinks are not followed. */
  static byteSize(contentDir: string): number {
    let total = 0;
    const walk = (dir: string): void => {
      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry.isSymbolicLink()) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        try { total += fs.statSync(full).size; } catch { /* vanished mid-walk; it contributes nothing */ }
      }
    };
    walk(contentDir);
    return total;
  }
}
