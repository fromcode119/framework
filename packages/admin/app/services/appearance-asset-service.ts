import fs from 'node:fs';
import path from 'node:path';

/**
 * Serves an external appearance's built assets (its `dist/` bundle + any css) from the mounted
 * APPEARANCE_DIR (repo-root appearance/<slug>/, bind-mounted to /app/appearance). Used by the admin
 * appearance asset route so the browser can dynamically import an appearance bundle at runtime.
 */
export class AppearanceAssetService {
  /**
   * An appearance ships its own brand (see `build-appearances.sh`, which copies `assets/` into
   * `dist/`), so this route serves images too — not just the bundle and its stylesheet. Everything
   * unrecognised stays JavaScript, which is what the bundle and its chunks are. Getting this wrong is
   * not cosmetic: a PNG served as `application/javascript` renders today only because browsers sniff
   * `<img>` content, and stops the moment anything sets `nosniff`.
   */
  private static readonly TYPES: Readonly<Record<string, string>> = {
    '.css': 'text/css; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
  };

  private static contentType(rel: string): string {
    const dot = rel.lastIndexOf('.');
    const ext = dot < 0 ? '' : rel.slice(dot).toLowerCase();
    return AppearanceAssetService.TYPES[ext] ?? 'application/javascript; charset=utf-8';
  }

  static serve(slug: string, parts: string[]): Response {
    const baseDir = process.env.APPEARANCE_DIR || '';
    if (!baseDir) return new Response('appearance dir not configured', { status: 404 });

    const distRoot = path.resolve(baseDir, slug, 'dist');
    const full = path.resolve(distRoot, parts.join('/'));
    if (full !== distRoot && !full.startsWith(distRoot + path.sep)) {
      return new Response('forbidden', { status: 403 });
    }
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
      return new Response('not found', { status: 404 });
    }
    const body = fs.readFileSync(full);
    return new Response(body, {
      headers: {
        'content-type': AppearanceAssetService.contentType(parts.join('/')),
        // Never cache appearance assets — they are bind-mounted and rebuilt in place; a stale bundle
        // makes admins see an old UI after a rebuild. The loader also appends a per-load ?v= buster.
        'cache-control': 'no-store, must-revalidate',
      },
    });
  }
}
