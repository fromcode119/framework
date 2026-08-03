import { ApiRouteProxy } from '@/lib/api-route-proxy';

/** Same-origin proxy to the framework API. */
export class FrontendApiProxyRoute {
  static async GET(request: Request): Promise<Response> {
    return ApiRouteProxy.getResponse(request);
  }

  static async HEAD(request: Request): Promise<Response> {
    return ApiRouteProxy.getResponse(request);
  }
}
