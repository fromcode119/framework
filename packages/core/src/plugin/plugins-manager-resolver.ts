import type { IPluginApiResolver } from '@core/plugin/interfaces/plugin-api-resolver.interface';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { RequestContextUtils } from '@core/context/request-context';
import { PluginTenantAccess } from '@core/plugin/tenant/plugin-tenant-access';
import { TenantMode } from '@core/tenant/tenant-mode';

export class PluginsManagerResolver implements IPluginApiResolver {
  constructor(private readonly plugins: Map<string, ILoadedPlugin>) {}

  has(namespace: string, slug: string): boolean {
    return this.resolve(namespace, slug) !== undefined;
  }

  /**
   * Can this plugin's public API be handed to a caller acting for `tenantId`?
   *
   * THE ONE ANSWER. An isolated guest is told separately which peers it may call
   * (`PluginHost.peers`), and the host then re-decides when the call actually arrives. While those
   * two asked the question differently the guest was told yes and the host said no: the snapshot
   * left the tenant axis out, so on the per-site replay of `onInit` a guest saw a peer that would
   * not resolve, called it, and got `cannot read "<method>" of null` — reported to the operator as a
   * registration FAILURE for something working exactly as designed. Both sides now call this.
   *
   * The TENANT axis applies INSIDE a request only: `context.plugins.namespace(...)` must not hand one
   * plugin the public API of another that this customer does not run — that is a route around the
   * gate on every other seam, reached by calling a peer instead of an endpoint. With NO tenant (boot,
   * `plugins:ready`, a scheduler tick) there is no customer, and a plugin registering its providers
   * with a peer is platform work between two platform-active plugins; the peer's own data access is
   * still refused untenanted by its database proxy. Gating that made every cross-plugin registration
   * fail at boot and succeed only on the first request to the registering plugin.
   */
  static isResolvable(plugin: ILoadedPlugin, tenantId: string | null): boolean {
    if (PluginState.resolve(plugin.state) !== PluginState.ACTIVE || !plugin.publicAPI) return false;
    // A plugin whose process is DOWN is absent, not present-and-broken. Neither check above can see
    // that: the record is a spread copy of the host's stubs, so `state` stays ACTIVE and `publicAPI`
    // stays a truthy lazy proxy for the whole of a restart — while that proxy returns `undefined`
    // for every method, because the guest has not described itself yet. The caller then walked a
    // present target to a missing method and was told `"<method>" is not callable`, which reads as
    // a broken peer and, for a boot registration, was recorded as a failure the operator saw. Asked
    // here so the host walk and the guest's own peer snapshot cannot disagree.
    if (plugin.isRunning && !plugin.isRunning()) return false;
    const tenant = String(tenantId ?? '').trim();
    if (!tenant) return true;
    if (!TenantMode.isEnabled()) return true;
    return PluginTenantAccess.enabledSlugsFor(tenant).has(String(plugin.manifest?.slug ?? '').trim());
  }

  resolve(namespace: string, slug: string): unknown {
    const normalizedNamespace = String(namespace || '').trim().toLowerCase();
    const normalizedSlug = String(slug || '').trim().toLowerCase();
    const tenantId = RequestContextUtils.getTenantId() ?? null;

    for (const plugin of this.plugins.values()) {
      if (!PluginsManagerResolver.isResolvable(plugin, tenantId)) {
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
