import { AdminApiRouteProxy } from '@/lib/api-route-proxy';

/**
 * Same-origin proxy to the framework API.
 *
 * Every method, not just reads: the admin bundle calls the API on the page's own host, so a
 * read-only proxy would load the console and then fail every save. Behind the platform gateway
 * these paths never reach this route at all; it is what a deployment without the gateway falls
 * back to. All behaviour lives in `AdminApiRouteProxy` — see the reasoning there.
 */
export class AdminApiProxyRoute {
  static async GET(request: Request): Promise<Response> {
    return AdminApiRouteProxy.getResponse(request);
  }

  static async HEAD(request: Request): Promise<Response> {
    return AdminApiRouteProxy.getResponse(request);
  }

  static async POST(request: Request): Promise<Response> {
    return AdminApiRouteProxy.getResponse(request);
  }

  static async PUT(request: Request): Promise<Response> {
    return AdminApiRouteProxy.getResponse(request);
  }

  static async PATCH(request: Request): Promise<Response> {
    return AdminApiRouteProxy.getResponse(request);
  }

  static async DELETE(request: Request): Promise<Response> {
    return AdminApiRouteProxy.getResponse(request);
  }
}
