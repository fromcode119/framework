import { PublicRouteProxy } from '../../lib/public-route-proxy';

export const dynamic = 'force-dynamic';

/**
 * Serves /robots.txt at the apex via the manifest-declared public-route registry
 * (any plugin that declares `ui.publicRoutes` with path `robots.txt` provides it).
 * The catch-all public-route handler only matches `.xml`, so robots needs its own route.
 * Falls back to a permissive default when no plugin provides the route or the
 * upstream fails, preserving the previous behavior.
 */
export async function GET(): Promise<Response> {
  const upstream = await PublicRouteProxy.getResponse('robots.txt');
  if (upstream.ok) return upstream;
  return new Response('User-agent: *\nAllow: /\n', {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
