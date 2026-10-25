import { ConsoleMountConstants } from '@core/constants/console-mount.constants';
import { EnvUtils } from '@core/utils/env-utils';
import { RequestSurfaceHelper } from '@core/request-surface-helper';

/**
 * Putting a mounted console's path back in front of the addresses it writes (see
 * `ConsoleMountConstants`).
 *
 * `prefix` is idempotent: an address already under the mount is left alone. Admin routes, plugin
 * route services and appearances all build addresses, and several of them hand an already-built one
 * to the router — prefixing twice would send every such click to the storefront.
 */
export class ConsoleMountUtils {
  /** The same shape `TenantIdentity` accepts for a console path. Anything else is not a mount. */
  private static readonly PATH = /^(\/[a-z0-9][a-z0-9-]{0,62}){1,4}$/;

  /** The mount a header or attribute carries, or `''` when it carries none (or anything that is not a path). */
  static sanitize(value: unknown): string {
    const candidate = String(value ?? '').trim().toLowerCase().replace(/\/+$/, '');
    return ConsoleMountUtils.PATH.test(candidate) ? candidate : '';
  }

  /** The mount of the console document this code runs in; `''` on a server or when the console is not mounted. */
  static current(): string {
    if (EnvUtils.isServer()) return '';
    return ConsoleMountUtils.sanitize(document.documentElement?.getAttribute(ConsoleMountConstants.ATTRIBUTE));
  }

  /**
   * `path` under the mount. Only a root-relative path is touched: an absolute URL, a protocol-relative
   * one, a bare `#hash` or `?query` already says where it goes.
   */
  static prefix(path: string, mount: string = ConsoleMountUtils.current()): string {
    if (!mount || !path || !path.startsWith('/') || path.startsWith('//')) return path;
    if (ConsoleMountUtils.isUnder(path, mount)) return path;
    return path === '/' ? mount : `${mount}${path}`;
  }

  /** `path` with the mount taken off — the address the console's own routes know it by. */
  static strip(path: string, mount: string = ConsoleMountUtils.current()): string {
    if (!mount || !path || !ConsoleMountUtils.isUnder(path, mount)) return path;
    const rest = path.slice(mount.length);
    return !rest || rest.startsWith('?') || rest.startsWith('#') ? `/${rest}` : rest;
  }

  private static isUnder(path: string, mount: string): boolean {
    if (path === mount) return true;
    const next = path.charAt(mount.length);
    return path.startsWith(mount) && (next === '/' || next === '?' || next === '#');
  }

  /**
   * A request that came in through a site's console path (`shop.example.com/admin/...`). The gateway
   * names the mount in its own header and drops any copy a client sent, so the header is the gateway's
   * word, not the browser's. It matters where nothing else says "console": a top-level navigation back
   * from a provider (an OAuth return) carries no client header and the storefront's host, yet it belongs
   * to the console session that started it.
   */
  static isMountedRequest(requestLike: { headers?: Record<string, unknown>; get?: (name: string) => string | undefined }): boolean {
    return ConsoleMountUtils.sanitize(RequestSurfaceHelper.readHeader(requestLike, ConsoleMountConstants.HEADER)) !== '';
  }
}
