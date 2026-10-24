// Deep imports, never the sdk or core barrel: the root layout is a server graph, and those barrels
// re-export the `Reactor` class component, which React refuses there (see `admin-indexing-policy.ts`).
import type { IAppearanceBrand } from '@fromcode119/core/appearance/interfaces/appearance-brand.interface';
import { ApplicationUrlUtils } from '@fromcode119/core/utils/application-url-utils';
import { ApiPathUtils } from '@fromcode119/core/api/api-path-utils';
import { RouteConstants } from '@fromcode119/core/constants/route.constants';
import { ClientRuntimeConstants } from '@fromcode119/core/constants/client-runtime.constants';

/**
 * What THIS console is called and which icon it shows, when the site it serves wears an appearance.
 *
 * The page head — tab title, icons, home-screen name, web app manifest — is written on the server,
 * long before an appearance's code has loaded. It only knew the platform's own identity, so a site's
 * console painted as the platform and swapped to the site a moment later, and its icons never swapped
 * at all. The api already answers, on its public host route, which appearance the requesting host
 * wears; it now names that appearance's `name` and declared `icon` too, and this asks for them.
 *
 * The api tells hosts apart by the host the browser asked for, so that host is forwarded; and a host
 * that only serves a console at a PATH is answered as a console only for the admin's own client, so
 * that header is sent too.
 *
 * Cached per host for a minute. Any failure answers `null`, which keeps the platform's identity — the
 * page still works, it is merely not dressed as the site.
 */
export class AdminConsoleBrand {
  private static readonly TTL_MS = 60_000;
  /** Every console page waits on this answer, so an api that hangs must cost a moment, not the page. */
  private static readonly TIMEOUT_MS = 1_500;
  private static readonly cache = new Map<string, { at: number; brand: IAppearanceBrand | null }>();

  static async forHost(host: string): Promise<IAppearanceBrand | null> {
    // A proxy chain lists every host it passed through; the first is the one the browser asked for.
    const key = String(host || '').split(',')[0].trim().toLowerCase();
    if (!key) return null;
    const hit = AdminConsoleBrand.cache.get(key);
    if (hit && Date.now() - hit.at < AdminConsoleBrand.TTL_MS) return hit.brand;
    const brand = await AdminConsoleBrand.fetchBrand(key);
    AdminConsoleBrand.cache.set(key, { at: Date.now(), brand });
    return brand;
  }

  private static async fetchBrand(host: string): Promise<IAppearanceBrand | null> {
    try {
      const response = await fetch(AdminConsoleBrand.hostEndpoint(), {
        headers: {
          accept: 'application/json',
          'x-forwarded-host': host,
          [ClientRuntimeConstants.CLIENT_HEADER]: ClientRuntimeConstants.CLIENT_TYPES.ADMIN_UI,
        },
        signal: AbortSignal.timeout(AdminConsoleBrand.TIMEOUT_MS),
      });
      if (!response.ok) return null;
      const body = await response.json() as { workspace?: { brand?: Partial<IAppearanceBrand> | null } | null };
      const name = String(body?.workspace?.brand?.name || '').trim();
      if (!name) return null;
      return { name, icon: String(body?.workspace?.brand?.icon || '').trim() };
    } catch {
      return null;
    }
  }

  /** The api's public host route, from inside the admin's own process — see `AdminIndexingPolicy.hostEndpoint`. */
  private static hostEndpoint(): string {
    const base = String(process.env.API_URL || '').trim()
      || ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.API_APP);
    return ApplicationUrlUtils.joinApiPath(base.replace(/\/+$/, ''), ApiPathUtils.authPath(RouteConstants.SEGMENTS.HOST_INFO));
  }
}
