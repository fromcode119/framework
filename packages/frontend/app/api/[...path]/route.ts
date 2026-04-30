import { ApiRouteProxy } from '../../../lib/api-route-proxy';

export async function GET(request: Request): Promise<Response> {
  return ApiRouteProxy.getResponse(request);
}

export async function HEAD(request: Request): Promise<Response> {
  return ApiRouteProxy.getResponse(request);
}
