import { HostPermissionVerdict } from '@core/enums/host-permission-verdict.enum';
import { TenantRecord } from '@core/tenant/tenant-record';
import { TenantRouteMap } from '@core/tenant/tenant-route-map';

/**
 * Whether this platform will vouch for a hostname — the question an edge asks before it spends a
 * CERTIFICATE on it.
 *
 * It exists so the edge can be anything. A proxy that supports on-demand TLS asks this at handshake
 * time (Caddy's `permission`/`ask` endpoint is exactly one GET and one status code); a proxy that
 * cannot asks the routing LIST instead and reloads. Either way the platform answers in its own
 * terms — "yes, that is one of ours" — and never in a proxy's configuration language. Rendering one
 * vendor's config here would put its schema in the framework forever, which is the same mistake as
 * naming a theme's UI library.
 *
 * EXACT HOSTS ONLY, and no wildcards. A permission that matched suffixes would turn one tenant row
 * into an unlimited certificate budget: `*.customer.com` is a different feature, needs the customer's
 * own DNS credentials, and must be a visible per-tenant field before it exists at all.
 */
export class HostPermission {
  /**
   * The verdict for `host`.
   *
   * SUSPENDED is the one answer that differs from the routing map, deliberately. The map still routes
   * a suspended tenant so the visitor gets a 503 that says why — but the platform must not buy or
   * renew a certificate for a site that is switched off.
   *
   * A PRIVATE site is permitted. It serves a holding page and its own admins sign in over HTTPS;
   * refusing TLS would replace that holding page with a browser security warning and lock the
   * operator out of the site they are building. Visibility decides who may READ a site, never
   * whether it may have a certificate.
   */
  static decide(host: unknown, tenants: readonly TenantRecord[], platform: { admin?: string; api?: string; frontend?: string }): HostPermissionVerdict {
    const needle = HostPermission.normalize(host);
    if (!needle) return HostPermissionVerdict.UNKNOWN;

    const route = TenantRouteMap.build(tenants, platform).resolve(needle);
    if (!route) return HostPermissionVerdict.UNKNOWN;

    // A platform host (admin, api, frontend) has no tenant and is always ours.
    if (!route.tenantId) return HostPermissionVerdict.PERMITTED;

    const tenant = tenants.find((candidate) => candidate.id === route.tenantId);
    if (!tenant) return HostPermissionVerdict.UNKNOWN;
    return tenant.isActive ? HostPermissionVerdict.PERMITTED : HostPermissionVerdict.SUSPENDED;
  }

  /**
   * A hostname, or `''` for anything that is not one.
   *
   * Everything refused here is refused because it could alias two different rows or name something
   * no certificate authority would issue for anyway: a port or path (the caller must send a bare
   * host), a trailing dot (`acme.test.` and `acme.test` are the same name to DNS and different
   * strings to a Map), a bare IP address, and the loopback names. Lowercased, because a host is
   * case-insensitive and two cases must never be two entries.
   */
  private static normalize(host: unknown): string {
    const raw = String(host ?? '').trim().toLowerCase();
    if (!raw) return '';
    if (raw.includes('/') || raw.includes(':') || raw.includes(' ')) return '';

    const name = raw.replace(/\.$/, '');
    if (!name || name.length > 253) return '';
    if (name === 'localhost') return '';
    // A literal IPv4 address. Certificates for these are not something this platform hands out.
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(name)) return '';
    // One or more labels, letters/digits/hyphen, not starting or ending with a hyphen.
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/.test(name)) return '';
    return name;
  }
}
