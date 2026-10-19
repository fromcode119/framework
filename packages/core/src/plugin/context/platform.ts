import { ApiPathUtils } from '@core/api/api-path-utils';
import { RequestContextUtils } from '@core/context/request-context';
import { ApplicationUrlUtils } from '@core/utils/application-url-utils';
import { SiteBaseUrl } from '@core/tenant/site-base-url';
import { TenantMode } from '@core/tenant/tenant-mode';
import { PluginPlatformRoute } from '@core/plugin/context/plugin-platform-route';
import { PluginPlatformClaims } from '@core/plugin/platform/plugin-platform-claims';
import { PluginPlatformDelivery } from '@core/plugin/platform/plugin-platform-delivery';
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
 */
export class PlatformContextProxy {
  static createPlatformProxy(manager: IPluginManagerInterface, plugin: { manifest: { slug: string; platform?: boolean } }): IPluginContextPlatform {
    const slug = plugin.manifest.slug;
    const claims = new PluginPlatformClaims(manager.db);
    const delivery = new PluginPlatformDelivery(manager.db);
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

      connectUrl: async (path, returnTo = '/') => {
        const tenantId = requireTenantScope('a connect link');
        // Only a path on this site's own console: an absolute address would make the platform an open redirect.
        const back = String(returnTo ?? '/').trim() || '/';
        if (!back.startsWith('/') || back.startsWith('//')) throw new Error(`plugin "${slug}": returnTo must be a path on this site`);
        // Back to the console the operator is on — the platform's, a workspace's or the site's own; the
        // site's record cannot say which. The browser's word for it is kept only when it names a console
        // this deployment declares (SiteBaseUrl.consoleOrigin), so neither half of the return is the caller's.
        const reported = await SiteBaseUrl.consoleOrigin(RequestContextUtils.getAdminOrigin() ?? '', tenantId ?? '');
        const consoleOrigin = reported || await SiteBaseUrl.forCurrentSite(ApplicationUrlUtils.ADMIN_APP);
        const ticket = PluginPlatformTicket.mint({ slug, tenantId, returnTo: `${consoleOrigin}${back}` });
        const base = ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.API_APP);
        const route = ApiPathUtils.pluginPath(slug, `${PluginPlatformRoute.SEGMENT}/${String(path ?? '').replace(/^\/+/, '')}`);
        return `${base}${route}?ticket=${encodeURIComponent(ticket)}`;
      },

      claim: async (ticket, keys, payload) => {
        requirePlatformScope('completing a claim');
        const opened = PluginPlatformTicket.open(slug, String(ticket ?? ''));
        if (!opened) return { valid: false, granted: [], refused: [], delivered: false, returnTo: '' };
        const outcome = await claims.claim(slug, opened.tenantId, keys);
        let delivered = false;
        if (outcome.granted.length && payload !== undefined) {
          delivered = (await delivery.deliver(slug, opened.tenantId, { kind: 'claimed', keys: outcome.granted, payload })).delivered;
        }
        return { valid: true, ...outcome, delivered, returnTo: opened.returnTo };
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
