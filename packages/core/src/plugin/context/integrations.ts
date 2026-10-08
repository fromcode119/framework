import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import { PluginKeyspace } from '@core/plugin/context/plugin-keyspace';
import { ContextSecurityProxy } from '@core/plugin/context/utils';

export class IntegrationsContextProxy {
  static createIntegrationsProxy(
    plugin: ILoadedPlugin,
    manager: IPluginManagerInterface,
    security: ReturnType<typeof ContextSecurityProxy.createSecurityHelpers>
  ) {
    const { hasCapability, handleViolation } = security;
    return {
      registerType: (definition: any) => {
        // A type can carry its providers inline (a courier adapter registers its courier this way), so they get
        // the same namespace stamp as `registerProvider` below.
        const providers = Array.isArray(definition?.providers)
          ? definition.providers.map((provider: any) => ({ ...provider, namespace: plugin.manifest.namespace }))
          : definition?.providers;
        manager.integrations.registerType({ ...definition, providers }, plugin.manifest.slug);
      },
      registerProvider: (typeKey: string, provider: any) => {
        // The registering plugin's namespace travels with the provider, so a saved integration entry
        // can say where its plugin lives — the admin save used to drop the only copy of it.
        manager.integrations.registerProvider(typeKey, { ...provider, namespace: plugin.manifest.namespace }, plugin.manifest.slug);
      },
      get: async (typeKey: string) => {
        if (!hasCapability(`integration:${typeKey}`) && !hasCapability('integrations')) {
          handleViolation(`integration:${typeKey}`);
        }
        return manager.integrations.get(typeKey);
      },
      // A starting entry for the type's list, created only when missing. Writing a type's list is the same
      // power as reading and building its clients, so it takes the same capability.
      ensureEntry: async (typeKey: string, entry: { id?: string; providerKey: string; name?: string; enabled?: boolean; config?: Record<string, any> }) => {
        if (!hasCapability(`integration:${typeKey}`) && !hasCapability('integrations')) {
          handleViolation(`integration:${typeKey}`);
        }
        return manager.integrations.entrySeeder.ensure(typeKey, entry);
      },
      instantiateWithConfig: async (typeKey: string, providerKey: string, config?: Record<string, any>) => {
        if (!hasCapability(`integration:${typeKey}`) && !hasCapability('integrations')) {
          handleViolation(`integration:${typeKey}`);
        }
        return manager.integrations.instantiateWithConfig(typeKey, providerKey, config || {});
      }
    };
  }

  static createStorageProxy(
    plugin: ILoadedPlugin,
    manager: IPluginManagerInterface,
    security: ReturnType<typeof ContextSecurityProxy.createSecurityHelpers>
  ) {
    const target = (manager.integrations as any).storage;
    if (!target) return null;
    return new Proxy(target, {
      get: (obj: any, prop: string) => {
        const original = obj[prop];
        if (typeof original === 'function') {
          return (...args: any[]) => {
            if (['upload', 'delete', 'get', 'exists', 'getUrl'].includes(prop)) {
              if (args.length > 0 && typeof args[0] === 'string') {
                const sanitizedPath = args[0].replace(/\.\./g, '');
                args[0] = `plugins/${plugin.manifest.slug}/${sanitizedPath.startsWith('/') ? sanitizedPath.slice(1) : sanitizedPath}`;
              }
            }
            return original.apply(obj, args);
          };
        }
        return original;
      }
    });
  }

  static createCacheProxy(
    plugin: ILoadedPlugin,
    manager: IPluginManagerInterface,
    security: ReturnType<typeof ContextSecurityProxy.createSecurityHelpers>
  ) {
    const slug = plugin.manifest.slug;
    const target = (manager.integrations as any).cache;
    if (!target) return null;
    // Per SITE as well as per plugin — see PluginKeyspace.
    const key = (name: string) => `${PluginKeyspace.prefix('cache', slug)}${name}`;
    return {
      get: (name: string) => target.get(key(name)),
      set: (name: string, value: any, ttl?: number) => target.set(key(name), value, ttl),
      del: (name: string) => target.del(key(name))
    };
  }
}
