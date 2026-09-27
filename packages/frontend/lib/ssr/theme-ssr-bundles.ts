import { statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { ThemeSsrRuntime } from '@/lib/ssr/theme-ssr-runtime';

/**
 * Where each server bundle lives, and a stamp of what is on disk there.
 *
 * The render world is keyed by the theme's and plugins' versions, but a version is a number someone
 * edits: a plugin rebuilt at the SAME version kept its signature, so the storefront went on rendering
 * the previous build. The api papered over that by restarting the whole frontend after every install —
 * a moment with nothing serving the storefront. The stamp is taken from the file the world actually
 * imports (size and mtime, `stat` only), so any rebuild moves the signature, a fresh render world is
 * built beside the old one, and nothing has to restart.
 */
export class ThemeSsrBundles {
  static themeEntry(slug: string): string {
    return join(ThemeSsrRuntime.themesDir(), slug, 'ui-ssr', 'entry.mjs');
  }

  static pluginEntry(slug: string): string {
    return join(ThemeSsrRuntime.pluginsDir(), slug, 'ui-ssr', 'entry.mjs');
  }

  /** A short digest of the bundle file, or `''` when it is not on disk — never an invented stamp. */
  static stamp(entry: string): string {
    try {
      const stats = statSync(entry);
      return createHash('sha1').update(`${stats.size}:${Math.round(stats.mtimeMs)}`).digest('hex').slice(0, 8);
    } catch {
      return '';
    }
  }
}
