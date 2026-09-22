import * as fs from 'fs';
import * as path from 'path';

/**
 * The version of a plugin that is ON DISK, as opposed to the one this process is RUNNING.
 *
 * These drift apart and nothing used to say so. Measured on production 2026-09-22: `_system_plugins`
 * read `ecommerce 0.1.138`, the manifest on disk read `0.1.138`, the release tag read `0.1.138` — and
 * the admin rendered the `0.1.136` form, because the api had been up since before the files changed
 * and holds each plugin's manifest and collection schema in memory from boot. Three version signals
 * agreed with each other and all three were wrong about what was being served.
 *
 * The registry row is not the answer either: it is written by whoever INSTALLS, which on that box is
 * something outside the api. The only honest comparison is the manifest sitting next to the code the
 * process loaded, against the manifest the process actually loaded.
 *
 * Reads are cached for a few seconds. The health endpoint is polled by an admin screen, and a `stat`
 * plus a small `readFile` per plugin per request is needless when this value changes at most once per
 * install.
 */
export class PluginInstalledVersionService {
  private static readonly CACHE_TTL_MS = 5000;

  private static cache = new Map<string, { version: string | null; readAt: number }>();

  /**
   * The `version` in `<pluginPath>/manifest.json`, or null when it cannot be read.
   *
   * Null means "cannot tell", never "changed". A plugin loaded from somewhere without a path, a
   * manifest that has been deleted, or unparseable JSON must not be reported as a pending restart —
   * that would put a permanent warning on the screen that no restart could clear.
   */
  static onDisk(pluginPath: string | undefined): string | null {
    if (!pluginPath) return null;

    const cached = PluginInstalledVersionService.cache.get(pluginPath);
    if (cached && Date.now() - cached.readAt < PluginInstalledVersionService.CACHE_TTL_MS) {
      return cached.version;
    }

    let version: string | null = null;
    try {
      const raw = fs.readFileSync(path.join(pluginPath, 'manifest.json'), 'utf8');
      const parsed = JSON.parse(raw) as { version?: unknown };
      version = typeof parsed.version === 'string' && parsed.version.trim() ? parsed.version.trim() : null;
    } catch {
      version = null;
    }

    PluginInstalledVersionService.cache.set(pluginPath, { version, readAt: Date.now() });
    return version;
  }

  /** Testing seam — the cache is process-wide and would otherwise leak between cases. */
  static resetCache(): void {
    PluginInstalledVersionService.cache.clear();
  }
}
