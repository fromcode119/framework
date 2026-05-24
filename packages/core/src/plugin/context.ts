import { 
  PluginContext, 
  LoadedPlugin, 
} from '../types';
import { Logger } from '../logging';
import type { PluginManagerInterface } from './context/utils.interfaces';
import { ContextSecurityProxy } from './context/utils';
import { ApiContextProxy } from './context/api';
import { DatabaseContextProxy } from './context/database';
import { IntegrationsContextProxy } from './context/integrations';
import { JobsContextProxy } from './context/jobs';
import { SchedulerContextProxy } from './context/scheduler';
import { CollectionsContextProxy } from './context/collections';
import { I18nContextProxy } from './context/i18n';
import { SettingsContextProxy } from './context/settings';
import { UiContextProxy } from './context/ui';
import { UsersContextProxy } from './context/users';
import { MetaContextProxy } from './context/meta';
import { RolesContextProxy } from './context/roles';
import { ThemeContextProxy } from './context/theme';
import { PluginsFacade } from '../plugins-facade';
import { PluginsManagerResolver } from '../plugins-manager-resolver';
import { PluginPathContextProxy } from './context/paths';
import { EntitiesContextProxy } from './context/entities';

export class PluginContextFactory {
  static createPluginContext(
  plugin: LoadedPlugin,
  manager: PluginManagerInterface,
  rootLogger: Logger
): PluginContext {
      const pluginLogger = rootLogger.child(plugin.manifest.slug);
      const security = ContextSecurityProxy.createSecurityHelpers(plugin, manager, rootLogger);
      const pluginsFacade = new PluginsFacade(new PluginsManagerResolver(manager.plugins));
      const pathContext = new PluginPathContextProxy(plugin, manager);
      const requireDependency = <TDependency = any>(key: string): TDependency => {
        if (!security.hasCapability('plugins:interact')) security.handleViolation('plugins:interact');
        const separatorIndex = key.indexOf(':');
        const namespace = separatorIndex >= 0 ? key.slice(0, separatorIndex).trim() : '';
        const slug = separatorIndex >= 0 ? key.slice(separatorIndex + 1).trim() : '';
        if (!namespace || !slug) {
          throw new Error(`Invalid dependency key "${key}". Expected "namespace:slug".`);
        }

        const dependency = pluginsFacade.get(namespace, slug);
        if (dependency === null || dependency === undefined) {
          throw new Error(`Missing required dependency: ${key}`);
        }

        return dependency as TDependency;
      };
      const optionalDependency = <TDependency = any>(key: string): TDependency | null => {
        if (!security.hasCapability('plugins:interact')) security.handleViolation('plugins:interact');
        const separatorIndex = key.indexOf(':');
        const namespace = separatorIndex >= 0 ? key.slice(0, separatorIndex).trim() : '';
        const slug = separatorIndex >= 0 ? key.slice(separatorIndex + 1).trim() : '';
        if (!namespace || !slug) {
          throw new Error(`Invalid dependency key "${key}". Expected "namespace:slug".`);
        }

        const dependency = pluginsFacade.get(namespace, slug);
        return dependency === null || dependency === undefined ? null : dependency as TDependency;
      };

      const context: PluginContext = {
        db: DatabaseContextProxy.createDatabaseProxy(plugin, manager, security) as any,
        api: ApiContextProxy.createApiProxy(plugin, manager, pluginLogger, security),
        hooks: {
          on: (event: string, handler: any) => {
            if (!security.hasCapability('hooks')) security.handleViolation('hooks');
            const wrappedHandler = async (payload: any, ev: string) => {
              const currentPlugin = manager.plugins.get(plugin.manifest.slug);
              if (!currentPlugin || currentPlugin.state !== 'active') return;
              return handler(payload, ev);
            };
            (handler as any)._wrapped = wrappedHandler;
            manager.hooks.on(event, wrappedHandler);
          },
          off: (event: string, handler: any) => {
            manager.hooks.off(event, (handler as any)._wrapped || handler);
          },
          emit: (event: string, payload: any) => {
            if (!security.hasCapability('hooks')) security.handleViolation('hooks');
            manager.hooks.emit(event, payload);
          },
          call: (event: string, payload: any) => {
            if (!security.hasCapability('hooks')) security.handleViolation('hooks');
            return manager.hooks.call(event, payload);
          }
        },
        auth: manager.auth || {
          hashPassword: () => { throw new Error('Auth service not initialized'); },
          comparePassword: () => { throw new Error('Auth service not initialized'); },
          generateToken: () => { throw new Error('Auth service not initialized'); },
          verifyToken: () => { throw new Error('Auth service not initialized'); },
        },
        integrations: IntegrationsContextProxy.createIntegrationsProxy(plugin, manager, security) as any,

        // Shortcuts for core integrations
        get storage() {
          if (!security.hasCapability('storage')) security.handleViolation('storage');
          return IntegrationsContextProxy.createStorageProxy(plugin, manager, security) as any;
        },
        get email() {
          if (!security.hasCapability('email')) security.handleViolation('email');
          return manager.integrations.email;
        },
        get cache() {
          if (!security.hasCapability('cache')) security.handleViolation('cache');
          return IntegrationsContextProxy.createCacheProxy(plugin, manager, security) as any;
        },

        redis: JobsContextProxy.createRedisProxy(plugin, manager, security),
        fetch: async (url: string, init?: any) => {
          if (!security.hasCapability('network')) {
            security.handleViolation('network');
          }
          manager.audit.logAction(plugin.manifest.slug, 'Network Request', url, 'allowed');
          return fetch(url, init);
        },
        jobs: JobsContextProxy.createJobsProxy(plugin, manager, security) as any,
        scheduler: SchedulerContextProxy.createSchedulerProxy(plugin, manager, security),
        logger: {
          info: (msg: string) => {
            pluginLogger.info(msg);
            manager.writeLog('INFO', msg, plugin.manifest.slug);
          },
          warn: (msg: string) => {
            pluginLogger.warn(msg);
            manager.writeLog('WARN', msg, plugin.manifest.slug);
          },
          error: (msg: string) => {
            pluginLogger.error(msg);
            manager.writeLog('ERROR', msg, plugin.manifest.slug);
          },
        },
        plugin: {
          slug: plugin.manifest.slug,
          namespace: String(plugin.manifest.namespace || '').trim(),
          version: plugin.manifest.version,
          dataDir: `./data/plugins/${plugin.manifest.slug}`,
          rootDir: pathContext.currentPluginRoot,
          config: plugin.manifest.config || {},
        },
        paths: pathContext,
        plugins: {
          namespace: (namespace: string) => {
            if (!security.hasCapability('plugins:interact')) security.handleViolation('plugins:interact');
            return pluginsFacade.namespace(namespace);
          },
          has: (namespace: string, slug: string) => {
            if (!security.hasCapability('plugins:interact')) security.handleViolation('plugins:interact');
            return pluginsFacade.has(namespace, slug);
          },
          get: (namespace: string, slug: string) => {
            if (!security.hasCapability('plugins:interact')) security.handleViolation('plugins:interact');
            return pluginsFacade.get(namespace, slug);
          },
          require: requireDependency,
          optional: optionalDependency,
          isEnabled: (slug: string) => {
            if (!security.hasCapability('plugins:interact')) security.handleViolation('plugins:interact');
            return manager.plugins.get(slug)?.state === 'active';
          },
          emit: (event: string, payload: any) => {
            if (!security.hasCapability('hooks')) security.handleViolation('hooks');
            manager.hooks.emit(event, payload);
          },
          on: (event: string, handler: any) => {
            if (!security.hasCapability('hooks')) security.handleViolation('hooks');
            manager.hooks.on(event, handler);
          }
        },
        dependencies: {
          require: requireDependency,
          optional: optionalDependency,
        },
        extensions: {
          installArchive: async (input: { filePath: string; type: 'plugin' | 'theme' | 'core'; enable?: boolean; activate?: boolean }) => {
            if (!security.hasCapability('extensions:manage')) {
              security.handleViolation('extensions:manage');
            }

            return manager.installExtensionArchive(input.filePath, input.type, {
              activate: input.activate,
              enable: input.enable,
            });
          }
        },
        users: UsersContextProxy.createUsersProxy(plugin, manager),
        meta: MetaContextProxy.createMetaProxy(manager),
        roles: RolesContextProxy.createRolesProxy(manager),
        theme: ThemeContextProxy.createThemeProxy(plugin, manager),
        entities: EntitiesContextProxy.createEntitiesProxy(),
        collections: CollectionsContextProxy.createCollectionsProxy(plugin, manager, rootLogger, security),
        settings: SettingsContextProxy.createSettingsProxy(plugin, manager),
        i18n: I18nContextProxy.createI18nProxy(plugin, manager, pathContext, security),
        t: (key: string, params?: Record<string, any>) => {
          const i18n = I18nContextProxy.createI18nProxy(plugin, manager, pathContext, security);
          return i18n.t(key, params);
        },
        ui: UiContextProxy.createUiProxy(plugin, manager),
        runtime: {
          registerModule: (name: string, config: { keys: string[], type: 'icon' | 'lib' }) => {
            manager.runtime.registerModule(name, config);
            rootLogger.info(`Plugin "${plugin.manifest.slug}" registered runtime module bridge: ${name} (${config.type})`);
          }
        }
      };

      return context;

  }
}
