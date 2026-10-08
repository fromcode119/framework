import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import { SystemConstants } from '@core/constants/system.constants';
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
    /**
     * The contract (`IMediaManager`) and nothing else. This was a Proxy over the whole media manager
     * whose path sandbox named methods the manager does not have (`delete`, `get`, `exists`, `getUrl`),
     * so no path was ever confined, and `driver` / `register` handed out the raw storage driver.
     *
     * `upload` keeps only the file's base name and gives it a random one, so it cannot be steered.
     * `remove` refuses a file the media library owns: those paths are listable (`context.media.list`),
     * a plugin's own uploads are random names only it knows. The driver confines the path itself.
     */
    return {
      upload: (file: Buffer, filename: string, options?: { space?: string }) => target.upload(file, filename, options),
      remove: async (filepath: string, space?: string) => {
        const stored = String(filepath ?? '').trim();
        if (!stored) throw new Error('context.storage.remove needs the path upload returned');
        const owned = await manager.db.withPlatformAdmin(() => manager.db.findOne(SystemConstants.TABLE.MEDIA, { path: stored }));
        if (owned) {
          throw new Error(`context.storage.remove refused "${stored}": it belongs to the media library, not to plugin "${plugin.manifest.slug}".`);
        }
        return target.remove(stored, space);
      },
    };
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
