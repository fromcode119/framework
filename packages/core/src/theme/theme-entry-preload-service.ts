import fs from 'fs';
import { SystemConstants } from '@core/constants/system.constants';
import path from 'path';

/**
 * ThemeEntryPreloadService
 *
 * Derives the list of theme UI module files the browser will need IMMEDIATELY when
 * the theme entry executes, so the frontend can emit `<link rel="modulepreload">`
 * hints for them and collapse the serialized discovery chain
 * (`bundle.js` shim -> real entry -> static vendor chunks) into one parallel fetch
 * wave (storefront-performance-audit.md 1.5/1.7, Phase 1.3).
 *
 * Resolution is filesystem-only and server-derived from the active theme's own
 * `ui/` directory — request input never reaches the returned filenames:
 *  1. If the declared entry is a tiny shim (`import "./index-<hash>.js";`), the
 *     shim's target is the real entry.
 *  2. The real entry's top-level static `import ... from "./<file>.js"` specifiers
 *     (same-directory only) are its hard dependencies (e.g. vendor chunks).
 * Only files that actually exist inside the `ui/` directory are returned.
 * Results are memoized per (directory, entry, mtime) so repeated
 * `/system/frontend` calls don't re-read files.
 */
export class ThemeEntryPreloadService {
  private static readonly SHIM_MAX_BYTES = 512;
  private static readonly IMPORT_SCAN_MAX_BYTES = 65536;
  private static readonly memo = new Map<string, { mtimeMs: number; files: string[] }>();

  static resolveModulePreloadList(themeDirectory: string, entryFile: string): string[] {
    try {
      const uiDirectory = path.resolve(String(themeDirectory || ''), SystemConstants.THEME_DIR.UI);
      const entryName = ThemeEntryPreloadService.sanitizeFileName(entryFile);
      if (!entryName) return [];

      const entryPath = path.resolve(uiDirectory, entryName);
      if (!entryPath.startsWith(`${uiDirectory}${path.sep}`) || !fs.existsSync(entryPath)) return [];

      const memoKey = `${uiDirectory}:${entryName}`;
      const mtimeMs = fs.statSync(entryPath).mtimeMs;
      const memoized = ThemeEntryPreloadService.memo.get(memoKey);
      if (memoized && memoized.mtimeMs === mtimeMs) return memoized.files;

      const files = ThemeEntryPreloadService.computePreloadList(uiDirectory, entryName, entryPath);
      ThemeEntryPreloadService.memo.set(memoKey, { mtimeMs, files });
      return files;
    } catch {
      return [];
    }
  }

  private static computePreloadList(uiDirectory: string, entryName: string, entryPath: string): string[] {
    const files: string[] = [];
    let realEntryName = entryName;
    let realEntryPath = entryPath;

    const shimTarget = ThemeEntryPreloadService.readShimTarget(uiDirectory, entryPath);
    if (shimTarget) {
      realEntryName = shimTarget;
      realEntryPath = path.resolve(uiDirectory, shimTarget);
      files.push(realEntryName);
    }

    for (const specifier of ThemeEntryPreloadService.readStaticImports(realEntryPath)) {
      const dependencyPath = path.resolve(uiDirectory, specifier);
      if (!dependencyPath.startsWith(`${uiDirectory}${path.sep}`)) continue;
      if (specifier === realEntryName || files.includes(specifier)) continue;
      if (!fs.existsSync(dependencyPath)) continue;
      files.push(specifier);
    }

    return files;
  }

  /** A shim entry is a tiny file whose only statement imports one sibling module. */
  private static readShimTarget(uiDirectory: string, entryPath: string): string | null {
    const stats = fs.statSync(entryPath);
    if (stats.size > ThemeEntryPreloadService.SHIM_MAX_BYTES) return null;
    const source = fs.readFileSync(entryPath, 'utf8').trim();
    const match = source.match(/^import\s*["']\.\/([\w@$.-]+\.m?js)["'];?$/);
    if (!match) return null;
    const target = ThemeEntryPreloadService.sanitizeFileName(match[1]);
    if (!target) return null;
    return fs.existsSync(path.resolve(uiDirectory, target)) ? target : null;
  }

  private static readStaticImports(filePath: string): string[] {
    if (!fs.existsSync(filePath)) return [];
    const buffer = Buffer.alloc(ThemeEntryPreloadService.IMPORT_SCAN_MAX_BYTES);
    const descriptor = fs.openSync(filePath, 'r');
    let bytesRead = 0;
    try {
      bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, 0);
    } finally {
      fs.closeSync(descriptor);
    }

    const head = buffer.subarray(0, bytesRead).toString('utf8');
    const specifiers: string[] = [];
    const importPattern = /import\s+(?:[\s\S]*?from\s*)?["']\.\/([\w@$.-]+\.m?js)["']/g;
    let match: RegExpExecArray | null;
    while ((match = importPattern.exec(head)) !== null) {
      const specifier = ThemeEntryPreloadService.sanitizeFileName(match[1]);
      if (specifier && !specifiers.includes(specifier)) specifiers.push(specifier);
    }
    return specifiers;
  }

  /** Strip any `?v=` cache-busting query and reject path separators/traversal. */
  private static sanitizeFileName(value: string): string {
    const name = String(value || '').trim().split('?')[0];
    if (!name || name.includes('/') || name.includes('\\') || name.includes('..')) return '';
    return name;
  }
}
