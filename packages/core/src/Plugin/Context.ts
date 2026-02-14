import { 
  PluginContext, 
  LoadedPlugin, 
} from '../types';
import { Logger } from '../logging/logger';
import { PluginManagerInterface, createSecurityHelpers } from './context/utils';
import { createApiProxy } from './context/api';
import { createDatabaseProxy } from './context/database';
import { 
  createIntegrationsProxy,
  createStorageProxy,
  createCacheProxy 
} from './context/integrations';
import { createJobsProxy, createRedisProxy } from './context/jobs';
import { createSchedulerProxy } from './context/scheduler';
import { createCollectionsProxy } from './context/collections';
import { createI18nProxy } from './context/i18n';
import { createSettingsProxy } from './context/settings';
import { createUiProxy } from './context/ui';

export { PluginManagerInterface };

/**
 * Factory function to create a PluginContext for a specific plugin.
 * This encapsulates all the proxy logic and capability checks.
 */
export function createPluginContext(
  plugin: LoadedPlugin,
  manager: PluginManagerInterface,
  rootLogger: Logger
): PluginContext {
  const pluginLogger = rootLogger.child(plugin.manifest.slug);
  const security = createSecurityHelpers(plugin, manager, rootLogger);

  const context: PluginContext = {
    db: createDatabaseProxy(plugin, manager, security) as any,
    api: createApiProxy(plugin, manager, pluginLogger, security),
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
    integrations: createIntegrationsProxy(plugin, manager, security) as any,

    // Shortcuts for core integrations
    get storage() {
      if (!security.hasCapability('storage')) security.handleViolation('storage');
      return createStorageProxy(plugin, manager, security) as any;
    },
    get email() {
      if (!security.hasCapability('email')) security.handleViolation('email');
      return manager.integrations.email;
    },
    get cache() {
      if (!security.hasCapability('cache')) security.handleViolation('cache');
      return createCacheProxy(plugin, manager, security) as any;
    },

    redis: createRedisProxy(plugin, manager, security),
    fetch: async (url: string, init?: any) => {
      if (!security.hasCapability('network')) {
        security.handleViolation('network');
      }
      manager.audit.logAction(plugin.manifest.slug, 'Network Request', url, 'allowed');
      return fetch(url, init);
    },
    jobs: createJobsProxy(plugin, manager, security) as any,
    scheduler: createSchedulerProxy(plugin, manager, security),
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
      version: plugin.manifest.version,
      dataDir: `./data/plugins/${plugin.manifest.slug}`,
      config: plugin.manifest.config || {},
    },
    plugins: {
      isEnabled: (slug: string) => {
        if (!security.hasCapability('plugins:interact')) security.handleViolation('plugins:interact');
        return manager.plugins.get(slug)?.state === 'active';
      },
      getAPI: (slug: string) => {
        if (!security.hasCapability('plugins:interact')) security.handleViolation('plugins:interact');
        return manager.plugins.get(slug)?.publicAPI;
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
    collections: createCollectionsProxy(plugin, manager, rootLogger, security),
    settings: createSettingsProxy(plugin, manager),
    i18n: createI18nProxy(plugin, manager, security),
    t: (key: string, params?: Record<string, any>) => {
      const i18n = createI18nProxy(plugin, manager, security);
      return i18n.t(key, params);
    },
    ui: createUiProxy(plugin, manager),
    runtime: {
      registerModule: (name: string, config: { keys: string[], type: 'icon' | 'lib' }) => {
        manager.runtime.registerModule(name, config);
        rootLogger.info(`Plugin "${plugin.manifest.slug}" registered runtime module bridge: ${name} (${config.type})`);
      }
    }
  };

  return context;
}
