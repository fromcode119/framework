import { AdminApiRouteProxy } from '@/lib/api-route-proxy';

/**
 * A plugin's admin UI bundle and stylesheet, same-origin.
 *
 * The admin loads `/plugins/<slug>/ui/bundle.js` from the host it was served from, and the API is
 * what serves those files from disk. Behind the framework gateway both apps sit on one origin and
 * the path resolves; on a deployment where the admin has its own host, nothing served it and every
 * plugin screen rendered blank — the page loaded, the import failed, and the only trace was one
 * console warning. Reads only: these are static files, and this route must never become a way to
 * write through to the API.
 */
export class PluginUiAssetProxyRoute {
  static async GET(request: Request): Promise<Response> {
    return AdminApiRouteProxy.getResponse(request);
  }

  static async HEAD(request: Request): Promise<Response> {
    return AdminApiRouteProxy.getResponse(request);
  }
}
