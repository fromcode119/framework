import { connection } from 'next/server';
import { PublicRouteProxy } from '@/lib/public-route-proxy';

/** Serves /robots.txt from the manifest-declared public-route registry. */
export class RobotsRoute {
  /**
   * Serves /robots.txt at the apex via the manifest-declared public-route registry
   * (any plugin that declares `ui.publicRoutes` with path `robots.txt` provides it).
   * The catch-all public-route handler only matches `.xml`, so robots needs its own route.
   * Falls back to a permissive default when no plugin provides the route or the
   * upstream fails, preserving the previous behavior.
   */
  static async GET(): Promise<Response> {
    // Opt into dynamic rendering without a route-segment `export const`.
    await connection();
    const upstream = await PublicRouteProxy.getResponse('robots.txt');
    if (upstream.ok) return upstream;
    return new Response('User-agent: *\nAllow: /\n', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
    });
  }
}
