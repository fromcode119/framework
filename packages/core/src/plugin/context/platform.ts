import { ApiPathUtils } from '@core/api/api-path-utils';
import { RequestContextUtils } from '@core/context/request-context';
import { ApplicationUrlUtils } from '@core/utils/application-url-utils';
import { SiteBaseUrl } from '@core/tenant/site-base-url';
import { TenantMode } from '@core/tenant/tenant-mode';
import { PluginPlatformRoute } from '@core/plugin/context/plugin-platform-route';
import { PluginPlatformClaims } from '@core/plugin/platform/plugin-platform-claims';
import { PluginPlatformDelivery } from '@core/plugin/platform/plugin-platform-delivery';
import { PluginPlatformHandoffs } from '@core/plugin/platform/plugin-platform-handoffs';
import { PluginPlatformReceivers } from '@core/plugin/platform/plugin-platform-receivers';
import { PluginPlatformSettings } from '@core/plugin/platform/plugin-platform-settings';
import { PluginPlatformTicket } from '@core/plugin/platform/plugin-platform-ticket';
import { PluginPlatformDeliveryReason } from '@core/plugin/platform/enums/plugin-platform-delivery-reason.enum';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import type { IPluginContextPlatform } from '@core/plugin/interfaces/plugin-context-platform.interface';

/**
 * `context.platform` — see {@link IPluginContextPlatform}.
 *
 * Built on the HOST: the platform settings, the claims and the ticket key never enter a plugin's
 * process. The PLATFORM part (code running where no site is bound) reads the platform settings and
 * completes claims; the TENANT part (code running for one site or workspace) asks for a connect link,
 * lists and releases its own claims, and receives what the platform part delivers. Neither can do the
 * other's half: the scope a call runs in is the framework's, not the plugin's to choose.
 *
 * A CONNECTION IS FINISHED BY THE OPERATOR WHO STARTED IT. The platform part answers whoever holds the
 * link, and a link can be sent to someone else: an admin of one site could have the owner of an account
 * approve the provider's dialog and receive that account. So the platform part never grants keys: it
 * parks them behind a one-time handoff (`PluginPlatformHandoffs`) and sends the browser back to the
 * console that asked, where `complete` grants them only to the same site AND the same signed-in account
 * that minted the ticket. The person a link was forwarded to has no session there, and the handoff is
 * spent on that first, failed attempt.
 */
export class PlatformContextProxy {
  static createPlatformProxy(manager: IPluginManagerInterface, plugin: { manifest: { slug: string; platform?: boolean } }): IPluginContextPlatform {
    const slug = plugin.manifest.slug;
    const claims = new PluginPlatformClaims(manager.db);
    const delivery = new PluginPlatformDelivery(manager.db);
    const handoffs = new PluginPlatformHandoffs(manager.db);
    const settings = new PluginPlatformSettings(manager.db);

    const requirePlatformPlugin = (): void => {
      if (plugin.manifest.platform !== true) throw new Error(`${PluginPlatformRoute.NOT_PLATFORM}: plugin "${slug}" does not declare a platform part`);
    };
    const currentTenant = (): string | null => (TenantMode.isEnabled() ? String(RequestContextUtils.getTenantId() ?? '').trim() || null : null);
    const requirePlatformScope = (what: string): void => {
      requirePlatformPlugin();
      if (TenantMode.isEnabled() && currentTenant()) throw new Error(`${PluginPlatformRoute.INSIDE_TENANT}: ${what} runs only where no site or workspace is bound`);
    };
    const requireTenantScope = (what: string): string | null => {
      requirePlatformPlugin();
      const tenantId = currentTenant();
      if (TenantMode.isEnabled() && !tenantId) throw new Error(`${PluginPlatformRoute.NEEDS_TENANT}: ${what} needs a site or workspace`);
      return tenantId;
    };

    return {
      registerSettings: (schema) => {
        requirePlatformPlugin();
        PluginPlatformSettings.register(slug, schema, manager.getPluginSettings(slug));
      },

      getSettings: async () => {
        requirePlatformScope('reading the platform settings');
        return settings.open(slug);
      },

      connectUrl: async (path, options) => {
        const tenantId = requireTenantScope('a connect link');
        const userId = RequestContextUtils.getSessionUserId();
        if (!userId) throw new Error(`${PluginPlatformRoute.NEEDS_ACCOUNT}: a connect link is minted only for a signed-in account`);
        // Only a path on this site's own console: an absolute address would make the platform an open redirect.
        const back = String(options?.returnTo ?? '/').trim() || '/';
        if (!back.startsWith('/') || back.startsWith('//')) throw new Error(`plugin "${slug}": returnTo must be a path on this site`);
        // The tenant part's own route that finishes the claim — never a platform route, which runs unbound.
        const finish = String(options?.completePath ?? '').trim().replace(/^\/+/, '');
        if (!finish || finish.includes('..') || /[?#\\]/.test(finish) || finish.split('/')[0].toLowerCase() === PluginPlatformRoute.SEGMENT) {
          throw new Error(`plugin "${slug}": completePath must name one of its own tenant routes`);
        }
        // Back to the console the operator is on — the platform's, a workspace's or the site's own; the
        // site's record cannot say which. The browser's word for it is kept only when it names a console
        // this deployment declares (SiteBaseUrl.consoleOrigin), so neither half of the return is the caller's.
        const reported = await SiteBaseUrl.consoleOrigin(RequestContextUtils.getAdminOrigin() ?? '', tenantId ?? '');
        const consoleOrigin = reported || await SiteBaseUrl.forCurrentSite(ApplicationUrlUtils.ADMIN_APP);
        const ticket = PluginPlatformTicket.mint({
          slug,
          tenantId,
          userId,
          returnTo: `${consoleOrigin}${back}`,
          completeUrl: `${consoleOrigin}${ApiPathUtils.pluginPath(slug, finish)}`,
        });
        const base = ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.API_APP);
        const route = ApiPathUtils.pluginPath(slug, `${PluginPlatformRoute.SEGMENT}/${String(path ?? '').replace(/^\/+/, '')}`);
        return `${base}${route}?ticket=${encodeURIComponent(ticket)}`;
      },

      claim: async (ticket, keys, payload) => {
        requirePlatformScope('handing over a claim');
        const opened = PluginPlatformTicket.open(slug, String(ticket ?? ''));
        const handoff = opened ? await handoffs.park(opened, keys, payload) : '';
        if (!opened || !handoff) return { valid: false, continueTo: '' };
        const continueTo = new URL(opened.completeUrl);
        continueTo.searchParams.set(PluginPlatformHandoffs.QUERY_PARAM, handoff);
        return { valid: true, continueTo: continueTo.toString() };
      },

      abandon: async (ticket) => {
        requirePlatformScope('abandoning a connection');
        const opened = PluginPlatformTicket.open(slug, String(ticket ?? ''));
        if (!opened || !(await handoffs.abandon(opened))) return { valid: false, returnTo: '' };
        return { valid: true, returnTo: opened.returnTo };
      },

      complete: async (handoff) => {
        const tenantId = requireTenantScope('completing a connection');
        const refused = { valid: false, granted: [], refused: [], payload: null, returnTo: '' };
        const parked = await handoffs.spend(slug, handoff);
        if (!parked || parked.tenantId !== tenantId) return refused;
        // Another account than the one that asked: on this site, so it may be told where to go back to.
        if (parked.userId !== RequestContextUtils.getSessionUserId()) return { ...refused, returnTo: parked.returnTo };
        const outcome = await claims.claim(slug, tenantId, parked.keys);
        return { valid: true, ...outcome, payload: parked.payload, returnTo: parked.returnTo };
      },

      deliver: async (key, payload) => {
        requirePlatformScope('delivering');
        const owner = await claims.ownerOf(slug, String(key ?? '').trim());
        if (!owner) return { delivered: false, reason: PluginPlatformDeliveryReason.UNCLAIMED.value };
        return delivery.deliver(slug, owner.tenantId, { kind: 'event', key: String(key).trim(), payload });
      },

      claims: async () => claims.keysOf(slug, requireTenantScope('listing claims')),

      release: async (keys) => claims.release(slug, requireTenantScope('releasing claims'), keys),

      onDelivery: (handler) => {
        requirePlatformPlugin();
        PluginPlatformReceivers.set(slug, handler);
      },
    };
  }
}
