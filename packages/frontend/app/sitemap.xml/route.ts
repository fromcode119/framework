import { PublicRouteProxy } from '../../lib/public-route-proxy';

export async function GET(): Promise<Response> {
  return PublicRouteProxy.getResponse('sitemap.xml');
}