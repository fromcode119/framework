import { ApiVersionUtils, GatewayTarget, RequestSurfaceUtils, TenantRouteMap } from '@fromcode119/core';

/**
 * A host DECLARED to be the api serves the api at its root.
 *
 * `api.example.com/plugins/x/webhook` is the api's `/api/plugins/x/webhook`: on a host that is the api
 * and nothing else, the api's own base path in front of every address only repeats the hostname. The
 * api itself still mounts everything under its base path, so the gateway puts it back on the way in
 * and the api sees exactly the request it always saw — tenancy, CSRF and the exempt routes included.
 *
 * Only the api HOST. A console or a storefront reaches the api on its own origin under the base path,
 * because there the bare roots (`/plugins/<slug>/settings`, `/media`) are the app's pages. And a path
 * that already names the api — the base path itself, the public uploads, extension assets — passes
 * unchanged, so every client that calls `api.example.com/api/...` today keeps working.
 */
export class GatewayApiHostPath {
  static upstream(map: TenantRouteMap | null, host: string, url: string): string {
    if (!map || map.setup) return url;
    if (map.resolve(host)?.target.value !== GatewayTarget.API.value) return url;
    if (RequestSurfaceUtils.isApiPathOnAppHost(url)) return url;
    return `${ApiVersionUtils.API_BASE_PATH}${url.startsWith('/') ? url : `/${url}`}`;
  }
}
