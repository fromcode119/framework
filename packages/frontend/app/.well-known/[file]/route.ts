import { PublicRouteProxy } from '@/lib/public-route-proxy';

/**
 * Serves a file under `/.well-known/` that a plugin declares in `ui.publicRoutes` with the path
 * `.well-known/<file>` (`security.txt`, RFC 9116, is the first).
 *
 * The root-file rewrite in `next.config.ts` matches one path segment only, so a well-known file needs
 * a route of its own. Nothing is served unless a plugin declares the path: the proxy answers its own
 * 404 for anything else. The ACME challenge never reaches this route; the gateway sends
 * `/.well-known/acme-challenge/` to the API.
 */
export class WellKnownFileRoute {
  static async GET(
    _request: Request,
    context: { params: Promise<{ file: string }> },
  ): Promise<Response> {
    const params = await context.params;
    const file = String(params?.file || '').trim();
    return PublicRouteProxy.getResponse(`.well-known/${file}`);
  }
}
