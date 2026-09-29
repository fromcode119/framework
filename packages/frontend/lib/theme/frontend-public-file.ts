import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * A file the frontend itself ships in `public/`, read from disk.
 *
 * Not fetched back over HTTP: the storefront asking its own public URL goes out through the request's
 * host — through the CDN and the gateway — and from inside the container that failed ("fetch failed"),
 * so every site without a favicon of its own served an empty 204 instead of the framework's mark.
 *
 * Two roots, as `FrontendRuntimeAssetManifest` has them: `next dev` runs from `packages/frontend`, while
 * the image starts the app from `/app`, where the files are under `packages/frontend/public`.
 */
export class FrontendPublicFile {
  static async read(publicPath: string): Promise<Buffer | null> {
    const relative = String(publicPath || '').replace(/^\/+/, '');
    if (!relative || relative.split('/').includes('..')) return null;
    const found = FrontendPublicFile.candidates(relative).find((candidate) => existsSync(candidate));
    return found ? readFile(found) : null;
  }

  private static candidates(relative: string): string[] {
    return [
      join(process.cwd(), 'public', relative),
      join(process.cwd(), 'packages', 'frontend', 'public', relative),
    ];
  }
}
