import { PublicRouteProxy } from '@/lib/public-route-proxy';

/** Serves /sitemap.xml from the manifest-declared public-route registry. */
export class SitemapRoute {
  static async GET(): Promise<Response> {
    return PublicRouteProxy.getResponse('sitemap.xml');
  }
}
