import fs from 'node:fs';
import path from 'node:path';

/**
 * Serves an external appearance's built assets (its `dist/` bundle + any css) from the mounted
 * APPEARANCE_DIR (repo-root appearance/<slug>/, bind-mounted to /app/appearance). Used by the admin
 * appearance asset route so the browser can dynamically import an appearance bundle at runtime.
 */
export class AppearanceAssetService {
  private static contentType(rel: string): string {
    if (rel.endsWith('.css')) return 'text/css; charset=utf-8';
    if (rel.endsWith('.map')) return 'application/json; charset=utf-8';
    return 'application/javascript; charset=utf-8';
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
        'cache-control': 'no-cache',
      },
    });
  }
}
