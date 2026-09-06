import { ApiRouteProxy } from '@/lib/api-route-proxy';

/**
 * Same-origin proxy to the framework API.
 *
 * Every method, not just reads: the storefront's browser calls the API on the page's own host, because
 * on a multi-site deployment that host is the only thing that says WHICH site a call belongs to. A
 * read-only proxy would have made that rule unusable — the catalogue would load and the checkout would
 * answer 405. Behind the platform gateway these paths never reach this route at all; it is what a
 * deployment without the gateway falls back to.
 */
export class FrontendApiProxyRoute {
  static async GET(request: Request): Promise<Response> {
    return ApiRouteProxy.getResponse(request);
  }

  static async HEAD(request: Request): Promise<Response> {
    return ApiRouteProxy.getResponse(request);
  }

  static async POST(request: Request): Promise<Response> {
    return ApiRouteProxy.getResponse(request);
  }

  static async PUT(request: Request): Promise<Response> {
    return ApiRouteProxy.getResponse(request);
  }

  static async PATCH(request: Request): Promise<Response> {
    return ApiRouteProxy.getResponse(request);
  }

  static async DELETE(request: Request): Promise<Response> {
    return ApiRouteProxy.getResponse(request);
  }
}
