import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IApiAccessDescriptor } from '@core/plugin/context/interfaces/api-access-descriptor.interface';
import { RequestContextUtils } from '@core/context/request-context';
import { ApiPathUtils } from '@core/api/api-path-utils';

/**
 * The rules of a plugin's PLATFORM routes — the part of a plugin that answers for every site or
 * workspace at once (a provider webhook, an OAuth callback), so it can never run inside one.
 *
 * - A platform route lives under the reserved first segment `platform/`, and only a route declared
 *   `{ platform: true }` may use it — so the API middleware can exempt exactly that prefix from
 *   host-to-tenant resolution without exempting anything else.
 * - Only a plugin whose manifest declares `platform: true` may register one. A site-uploaded
 *   plugin cannot declare it (TenantPluginPackagePolicy).
 * - It answers only while no site or workspace is bound. Tenant queries fail closed without one,
 *   so a platform handler cannot read a site's records; it hands work to a site through
 *   `context.platform.deliver`, which the framework routes.
 */
export class PluginPlatformRoute {
  static readonly SEGMENT = 'platform';
  static readonly NOT_PLATFORM = 'PLUGIN_NOT_PLATFORM';
  static readonly INSIDE_TENANT = 'PLATFORM_ROUTE_INSIDE_TENANT';
  static readonly NEEDS_TENANT = 'PLATFORM_CALL_NEEDS_TENANT';

  /** Slugs that registered at least one platform route — the only ones whose prefix is exempted. */
  private static readonly declared = new Set<string>();

  /** Refuses a registration that breaks the rules above. `cleanPath` has no leading slash. */
  static assertRegistration(slug: string, declaresPlatform: boolean, cleanPath: string, descriptor: IApiAccessDescriptor | undefined, method: string): void {
    // Case-insensitive, because Express routing is: `/Platform/x` must not slip past the reservation.
    const underSegment = cleanPath.split('/')[0].toLowerCase() === PluginPlatformRoute.SEGMENT;
    const isPlatform = descriptor?.platform === true;
    if (underSegment && (!isPlatform || method === 'use')) {
      throw new Error(`Conflict: Plugin "${slug}" registered /${cleanPath} — the "${PluginPlatformRoute.SEGMENT}/" segment is reserved for routes declared { platform: true }.`);
    }
    if (isPlatform && !underSegment) {
      throw new Error(`Conflict: Plugin "${slug}" declared /${cleanPath} a platform route — its path must start with "${PluginPlatformRoute.SEGMENT}/".`);
    }
    if (isPlatform && !declaresPlatform) {
      throw new Error(`Security Violation: Plugin "${slug}" registered a platform route but its manifest does not declare "platform": true.`);
    }
    if (isPlatform) PluginPlatformRoute.declared.add(String(slug).toLowerCase());
  }

  /**
   * Whether a request path addresses the reserved segment — `<plugins base>/<slug>/platform/<rest>`, in
   * any letter case. The API middleware exempts exactly these paths from host-to-tenant resolution, and
   * the plugin API refuses every NON-platform route that matches one (a `:id` route or a `use()`
   * middleware would otherwise answer an exempted request with no tenant bound).
   */
  static isPlatformRequest(rawPath: string): boolean {
    return PluginPlatformRoute.platformSlug(rawPath) !== null;
  }

  /**
   * Whether the API middleware may skip host-to-tenant resolution for this path: a platform request to a
   * plugin that actually registered a platform route. Any other plugin's `platform/` path keeps its tenant
   * and is refused by the plugin API, so the exemption reaches no plugin that never asked for it.
   */
  static isExemptRequest(rawPath: string): boolean {
    const slug = PluginPlatformRoute.platformSlug(rawPath);
    return slug !== null && PluginPlatformRoute.declared.has(slug);
  }

  private static platformSlug(rawPath: string): string | null {
    const base = ApiPathUtils.pluginPath('').replace(/\/+$/, '').toLowerCase();
    const path = String(rawPath || '').split('?')[0].toLowerCase();
    if (!path.startsWith(`${base}/`)) return null;
    const [slug, segment, ...rest] = path.slice(base.length + 1).split('/');
    return slug && segment === PluginPlatformRoute.SEGMENT && rest.join('/').length > 0 ? slug : null;
  }

  /** Why this request may not reach a platform route, or null when it may. */
  static refusal(plugin: ILoadedPlugin): { status: number; error: string; code: string } | null {
    if (plugin.manifest.platform !== true) {
      return { status: 403, error: `Plugin "${plugin.manifest.slug}" has no platform part`, code: PluginPlatformRoute.NOT_PLATFORM };
    }
    if (RequestContextUtils.getTenantId()) {
      return { status: 404, error: 'Platform routes answer only on the platform itself, never inside a site or workspace', code: PluginPlatformRoute.INSIDE_TENANT };
    }
    return null;
  }
}
