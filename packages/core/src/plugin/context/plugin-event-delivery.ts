import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import { RequestContextUtils } from '@core/context/request-context';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { PluginTenantAccess } from '@core/plugin/tenant/plugin-tenant-access';

/**
 * The handler a plugin's event subscription actually registers, so neither subscription can skip the
 * site a plugin is (not) enabled for.
 */
export class PluginEventDelivery {
  /**
   * `hooks.on`: only while the plugin is active, and only for a site that runs it. A hook fired
   * OUTSIDE a request (boot, a scheduler tick) has no tenant, and the gate answers false — the handler
   * does not run "for everyone", which is the same fail-open shape closed elsewhere. Per-tenant
   * scheduled work is not delivered by T2; a task that needs it must iterate tenants explicitly.
   */
  static forHook(manager: IPluginManagerInterface, slug: string, handler: (payload: any, ev: string) => unknown) {
    return async (payload: any, ev: string) => {
      const currentPlugin = manager.plugins.get(slug);
      if (!currentPlugin || currentPlugin.state !== PluginState.ACTIVE) return;
      if (!PluginTenantAccess.isEnabledForCurrentTenant(slug)) return;
      return handler(payload, ev);
    };
  }

  /**
   * `plugins.on`: an event from a site's request reaches only plugins that site runs — registered raw,
   * as it was, a plugin a site had switched off still received that site's events (its users, its
   * orders). Unlike a hook, an event with NO site (boot's `plugins:ready`) is still delivered: it is
   * the platform's, and dropping it would stop plugins learning their peers are up.
   */
  static forPluginEvent(slug: string, handler: (payload: any, ev: string) => unknown) {
    return async (payload: any, ev: string) => {
      if (RequestContextUtils.getTenantId() && !PluginTenantAccess.isEnabledForCurrentTenant(slug)) return;
      return handler(payload, ev);
    };
  }
}
