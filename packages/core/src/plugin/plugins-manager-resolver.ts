import type { IPluginApiResolver } from '@core/interfaces/plugin-api-resolver.interface';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { RequestContextUtils } from '@core/context/request-context';
import { PluginTenantAccess } from '@core/plugin/tenant/plugin-tenant-access';

export class PluginsManagerResolver implements IPluginApiResolver {
  constructor(private readonly plugins: Map<string, ILoadedPlugin>) {}

  has(namespace: string, slug: string): boolean {
    return this.resolve(namespace, slug) !== undefined;
  }

  resolve(namespace: string, slug: string): unknown {
    const normalizedNamespace = String(namespace || '').trim().toLowerCase();
    const normalizedSlug = String(slug || '').trim().toLowerCase();

    for (const plugin of this.plugins.values()) {
      if (plugin.state !== PluginState.ACTIVE || !plugin.publicAPI) {
        continue;
      }

      // The TENANT axis, INSIDE a request: `context.plugins.namespace(...)` must not hand one plugin the
      // public API of another that this customer does not run — a route around the gate on every
      // other seam, reached by calling a peer instead of an endpoint. OUTSIDE a request (boot,
      // `plugins:ready`, a scheduler tick) there is no customer: a plugin registering its providers with
      // a peer is platform work between two platform-active plugins, and the peer's own data access is
      // still refused untenanted by its database proxy. Gating it here made every cross-plugin
      // registration fail at boot and succeed only on the first request to the registering plugin.
      if (RequestContextUtils.getTenantId() && !PluginTenantAccess.isEnabledForCurrentTenant(plugin.manifest.slug)) {
        continue;
      }

      const pluginNamespace = String(plugin.manifest.namespace || '').trim().toLowerCase();
      const pluginSlug = String(plugin.manifest.slug || '').trim().toLowerCase();
      if (pluginNamespace === normalizedNamespace && pluginSlug === normalizedSlug) {
        return plugin.publicAPI;
      }
    }

    return undefined;
  }
}
