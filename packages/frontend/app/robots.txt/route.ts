import { SiteVisibilityVerdict } from '@/lib/document/site-visibility-verdict';
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
  /** One place that builds the response, so the headers cannot drift between the branches. */
  private static text(body: string): Response {
    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  static async GET(): Promise<Response> {
    // Opt into dynamic rendering without a route-segment `export const`.
    await connection();
    // A site that is not published says so BEFORE any plugin is consulted. Whether crawlers are
    // welcome is the platform's answer about the site, not a plugin's answer about content, and the
    // plugin that serves this file may not even be active — which is exactly how this route used to
    // hand out `Allow: /` for an unpublished site.
    if (await SiteVisibilityVerdict.isTenanted() && !(await SiteVisibilityVerdict.isIndexable())) {
      return RobotsRoute.text('User-agent: *\nDisallow: /\n');
    }

    const upstream = await PublicRouteProxy.getResponse('robots.txt');
    if (upstream.ok) return upstream;

    // No plugin serves this file, or the one that does is unreachable, and this deployment has no
    // site to ask about — so nothing here knows what the operator wanted.
    //
    // This stays PERMISSIVE, deliberately. RFC 9309 §2.3.1.4 makes an unreachable robots.txt a
    // complete disallow and that is the better default, but flipping it here would de-index every
    // existing single-site storefront the moment it upgraded — a live site going dark in search
    // because a plugin was inactive. That is a decision for an operator, not for an upgrade. The
    // visibility branch above already covers every site that has said it is not ready.
    //
    // `no-store` regardless: this answer is a symptom, and caching it for an hour outlives the fix.
    return RobotsRoute.text('User-agent: *\nAllow: /\n');
  }
}
