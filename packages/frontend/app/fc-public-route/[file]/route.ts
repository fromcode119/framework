import { PublicRouteProxy } from '@/lib/public-route-proxy';

/**
 * Serves a root file a plugin declares in `ui.publicRoutes` — `llms.txt`, a feed `.xml`, anything that
 * is not `robots.txt` or `sitemap.xml` (those keep routes of their own).
 *
 * `next.config.ts` rewrites every single-segment `*.txt` / `*.xml` request here. That is the only way to
 * reach them: an app-router folder cannot hold a dynamic segment with a suffix, so the
 * `[publicRoute].xml` folder this replaces only ever matched the literal path `/[publicRoute].xml`, and
 * every plugin-declared root file 404'd. The proxy answers its own 404 for a file no plugin declares.
 */
export class PublicFileRoute {
  static async GET(
    _request: Request,
    context: { params: Promise<{ file: string }> },
  ): Promise<Response> {
    const params = await context.params;
    return PublicRouteProxy.getResponse(String(params?.file || '').trim());
  }
}
