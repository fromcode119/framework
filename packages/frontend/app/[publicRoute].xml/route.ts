import { PublicRouteProxy } from '@/lib/public-route-proxy';

/** Serves any plugin-declared `.xml` public route. */
export class PublicXmlRoute {
  static async GET(
    _request: Request,
    context: { params: Promise<{ publicRoute: string }> },
  ): Promise<Response> {
    const params = await context.params;
    const publicRoute = String(params?.publicRoute || '').trim();
    return PublicRouteProxy.getResponse(`${publicRoute}.xml`);
  }
}
