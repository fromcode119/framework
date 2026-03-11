import { LoadedPlugin } from '../../types';
import type { PluginManagerInterface } from './utils.interfaces';
import { ContextSecurityProxy } from './utils';

export class IntegrationsContextProxy {
  static createIntegrationsProxy(
    plugin: LoadedPlugin,
    manager: PluginManagerInterface,
    security: ReturnType<typeof ContextSecurityProxy.createSecurityHelpers>
  ) {
    const { hasCapability, handleViolation } = security;
    return {
      registerType: (definition: any) => {
        manager.integrations.registerType(definition);
      },
      registerProvider: (typeKey: string, provider: any) => {
        manager.integrations.registerProvider(typeKey, provider);
      },
      get: async (typeKey: string) => {
        if (!hasCapability(`integration:${typeKey}`) && !hasCapability('integrations')) {
          handleViolation(`integration:${typeKey}`);
        }
        return manager.integrations.get(typeKey);
      }
    };
  }

  static createStorageProxy(
    plugin: LoadedPlugin,
    manager: PluginManagerInterface,
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
    plugin: LoadedPlugin,
    manager: PluginManagerInterface,
    security: ReturnType<typeof ContextSecurityProxy.createSecurityHelpers>
  ) {
    const cachePrefix = `cache:${plugin.manifest.slug}:`;
    const target = (manager.integrations as any).cache;
    if (!target) return null;
    return {
      get: (key: string) => target.get(`${cachePrefix}${key}`),
      set: (key: string, value: any, ttl?: number) => target.set(`${cachePrefix}${key}`, value, ttl),
      del: (key: string) => target.del(`${cachePrefix}${key}`)
    };
  }
}