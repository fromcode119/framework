import http from 'http';
import { ConsoleMountConstants, GatewayTarget, RequestSurfaceUtils, TenantRouteMap } from '@fromcode119/core';

/**
 * A site's console on a PATH of its own storefront host — the site form's "Console path".
 *
 * `shop.example.com/backend/settings` is the console's `/settings`: the gateway removes the path,
 * sends the request to the admin and names the mount in `ConsoleMountConstants.HEADER`, so the admin
 * renders exactly the page it renders on a console host and puts the mount back in front of every
 * address it writes. The admin's built assets come from `ConsoleMountConstants.ASSET_PREFIX`, which a
 * storefront never serves, so on a mounted host that root goes to the admin as well.
 *
 * The api keeps the paths it always had on an app host: they are checked first, so a console path can
 * never hide the uploads or the api, and the console itself calls the api on the same origin.
 */
export class GatewayConsoleMount {
  /** Where the request goes and what the admin is told, or null when this request is not for a mounted console. */
  static resolve(map: TenantRouteMap | null, host: string, url: string): { mount: string; url: string } | null {
    if (!map || map.setup) return null;
    const route = map.resolve(host);
    if (!route?.consolePath || RequestSurfaceUtils.isApiPathOnAppHost(url)) return null;
    const inner = route.consoleRequestPath(url);
    if (inner !== null) return { mount: route.consolePath, url: inner };
    if (GatewayConsoleMount.isAssetPath(url)) return { mount: route.consolePath, url };
    return null;
  }

  /** The upstream for a mounted request: the admin, unless the path inside the mount is the api's. */
  static targetFor(resolved: { url: string }, targets: Record<string, string>): string | null {
    const target = RequestSurfaceUtils.isApiPathOnAppHost(resolved.url) ? GatewayTarget.API : GatewayTarget.ADMIN;
    return targets[target.value] || null;
  }

  /**
   * A redirect the admin sends names its own routes (`/login`). On a mounted host that address is the
   * storefront's, so it is put back under the mount — relative, or absolute on this same host.
   */
  static rewriteLocation(location: string, mount: string, host: string): string {
    if (!location) return location;
    if (location.startsWith('/') && !location.startsWith('//')) return GatewayConsoleMount.prefix(location, mount);
    try {
      const url = new URL(location);
      if (url.hostname.toLowerCase() !== host) return location;
      url.pathname = GatewayConsoleMount.prefix(url.pathname, mount);
      return url.toString();
    } catch {
      return location;
    }
  }

  /** A client can never claim a mount: only the gateway sets the header, and only on a mounted request. */
  static applyHeader(req: http.IncomingMessage, mount: string | null): void {
    delete req.headers[ConsoleMountConstants.HEADER];
    if (mount) req.headers[ConsoleMountConstants.HEADER] = mount;
  }

  private static prefix(path: string, mount: string): string {
    if (path === mount || path.startsWith(`${mount}/`) || path.startsWith(`${mount}?`)) return path;
    if (GatewayConsoleMount.isAssetPath(path) || RequestSurfaceUtils.isApiPathOnAppHost(path)) return path;
    return path === '/' ? mount : `${mount}${path}`;
  }

  private static isAssetPath(path: string): boolean {
    const root = ConsoleMountConstants.ASSET_PREFIX;
    return path === root || path.startsWith(`${root}/`);
  }
}
