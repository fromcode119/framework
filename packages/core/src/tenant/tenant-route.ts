import { GatewayTarget } from '@core/tenant/gateway-target';

/** One host the gateway knows, and the app it belongs to. */
export class TenantRoute {
  /**
   * @param consolePath where this host also answers with its tenant's console (`/admin`), `''` for
   *   nowhere. Only a storefront host carries one: an admin host IS the console already.
   */
  constructor(readonly host: string, readonly target: GatewayTarget, readonly tenantId: string | null, readonly consolePath = '') {}

  toJSON(): Record<string, unknown> {
    return { host: this.host, target: this.target.value, tenantId: this.tenantId, consolePath: this.consolePath };
  }

  static from(raw: unknown): TenantRoute | null {
    const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const host = String(input.host ?? '').trim().toLowerCase();
    const target = GatewayTarget.parse(input.target);
    if (!host || !target) return null;
    const consolePath = target === GatewayTarget.FRONTEND ? String(input.consolePath ?? '').trim() : '';
    return new TenantRoute(host, target, input.tenantId ? String(input.tenantId) : null, consolePath);
  }

  /**
   * The request path with this host's console path removed, or null when the request is not for the
   * console. `/admin` and `/admin/x` are the console; `/administrator` is not.
   */
  consoleRequestPath(pathname: string): string | null {
    const mount = this.consolePath;
    if (!mount) return null;
    if (pathname === mount) return '/';
    if (pathname.startsWith(`${mount}/`) || pathname.startsWith(`${mount}?`)) return pathname.slice(mount.length).replace(/^\?/, '/?');
    return null;
  }
}
