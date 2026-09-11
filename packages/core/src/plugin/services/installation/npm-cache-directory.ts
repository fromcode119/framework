import fs from 'fs';
import path from 'path';

/**
 * A cache npm can actually write.
 *
 * npm derives its cache from `HOME`, which in a container is `/root` — owned by root while the
 * process runs as `node`. Every install therefore died with `EACCES` before it fetched anything,
 * and the failure surfaced as whatever the caller made of a non-zero exit code.
 *
 * Beside the directory being installed into, because that is writable by definition: the installer
 * is about to write `node_modules` there. One class rather than a line in each caller — the bug was
 * fixed in the plugin installer first and then found again, unchanged, in the theme compiler, which
 * spawns npm on its own.
 */
export class NpmCacheDirectory {
  private static readonly NAME = '.npm-cache';

  /** The env an npm spawn needs to succeed as a non-root user. Spread over `process.env`. */
  static environmentFor(directory: string): Record<string, string> {
    return { npm_config_cache: NpmCacheDirectory.resolve(directory) };
  }

  static resolve(directory: string): string {
    const cache = path.join(directory, NpmCacheDirectory.NAME);
    fs.mkdirSync(cache, { recursive: true });
    return cache;
  }
}
