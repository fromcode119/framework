import { 
  PluginContext, 
  LoadedPlugin, 
  Collection, 
  TranslationMap
} from '../types';
import { Logger } from '../logging/logger';
import { sql, count, eq, and, or } from 'drizzle-orm';
import { PluginPermissionsService } from '../security/permissions';

/**
 * Interface representing the necessary parts of PluginManager 
 * required to construct a PluginContext.
 */
export interface PluginManagerInterface {
  hooks: any;
  apiHost: any;
  db: any;
  storage: any;
  email: any;
  cache: any;
  jobs: any;
  redis?: any;
  auth: any;
  i18n: any;
  plugins: Map<string, LoadedPlugin>;
  pluginsRoot: string;
  registeredCollections: Map<string, { collection: Collection; pluginSlug: string }>;
  headInjections: Map<string, any[]>;
  runtime: any;
  getPlugins(): LoadedPlugin[];
  enable(slug: string): Promise<void>;
  disable(slug: string): Promise<void>;
  delete(slug: string): Promise<void>;
  getHeadInjections(slug: string): any[];
  savePluginConfig(slug: string, config: any): Promise<void>;
  getCollections(): Collection[];
  getCollection(slug: string): { collection: Collection; pluginSlug: string } | undefined;
  installFromZip(filePath: string, pluginsRoot?: string): Promise<void>;
  writeLog(level: string, message: string, pluginSlug?: string, context?: any): Promise<void>;
  disableWithError(slug: string, message: string): Promise<void>;
  emit(event: string, payload: any): void;
  getImportMap(): { imports: Record<string, string> };
  getRuntimeModules(): Record<string, any>;
  getAdminMetadata(): any;
  updatePlugin(slug: string, pkg: any): Promise<void>;
  createContext(plugin: LoadedPlugin): PluginContext;
  setAuth(auth: any): void;
  setApiHost(host: any): void;
}

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

  const hasCapability = (cap: string) =>
    PluginPermissionsService.hasPermission(plugin.manifest, cap) ||
    plugin.manifest.capabilities?.includes('*');

  const handleViolation = (cap: string) => {
    rootLogger.error(`Security Violation: Plugin "${plugin.manifest.slug}" attempted to use "${cap}" without declaration.`);
    manager.disableWithError(plugin.manifest.slug, `Security Violation: Missing "${cap}" capability.`);
    throw new Error(`Security Violation: Missing "${cap}" capability.`);
  };

  // --- Hooks Proxy ---
  const hooksProxy = new Proxy(manager.hooks, {
    get: (target, prop) => {
      if (!hasCapability('hooks')) handleViolation('hooks');
      return (target as any)[prop];
    }
  });

  // --- API Wrapper ---
  const createApiWrapper = (method: string) => (path: string, ...handlers: any[]) => {
    if (!hasCapability('api')) {
      handleViolation('api');
    }

    const prefix = `/api/${plugin.manifest.slug}`;
    const fullPath = path.startsWith('/') ? `${prefix}${path}` : `${prefix}/${path}`;

    if (!manager.apiHost) {
      pluginLogger.debug(`Registered ${method.toUpperCase()} ${fullPath} (MOCK)`);
      return;
    }

    // Wrap the handlers with a check that verifies the plugin is still active
    const wrappedHandlers = handlers.map(handler => (req: any, res: any, next: any) => {
      const currentPlugin = manager.plugins.get(plugin.manifest.slug);
      if (!currentPlugin || currentPlugin.state !== 'active') {
        return res.status(403).json({
          error: `Plugin "${plugin.manifest.slug}" is disabled`,
          code: 'PLUGIN_DISABLED'
        });
      }
      return handler(req, res, next);
    });

    manager.apiHost[method](fullPath, ...wrappedHandlers);
  };

  const api = {
    get: createApiWrapper('get'),
    post: createApiWrapper('post'),
    put: createApiWrapper('put'),
    delete: createApiWrapper('delete'),
    patch: createApiWrapper('patch'),
    use: createApiWrapper('use')
  };

  // --- Database Proxy ---
  const tablePrefix = `fcp_${plugin.manifest.slug.replace(/-/g, '_')}_`;

  // Wrap sql to automatically prefix identifiers to enforce isolation
  const wrappedSql = new Proxy(sql, {
    get: (target, prop) => {
      if (prop === 'identifier') {
        return (name: string) => sql.identifier(`${tablePrefix}${name}`);
      }
      return (target as any)[prop];
    },
    apply: (target, thisArg, argumentsList) => {
      return (target as any).apply(thisArg, argumentsList);
    }
  });

  const dbProxy = new Proxy(manager.db, {
    get: (target, prop) => {
      if (!hasCapability('database') && !hasCapability('database:read') && !hasCapability('database:write')) {
        handleViolation('database');
      }

      // Expose drizzle-orm utilities through the db object
      if (prop === 'sql') return wrappedSql;
      if (prop === 'count') return count;
      if (prop === 'eq') return eq;
      if (prop === 'and') return and;
      if (prop === 'or') return or;

      return (target as any)[prop];
    }
  });

  // --- Storage Proxy ---
  const storageProxy = new Proxy(manager.storage, {
    get: (target, prop) => {
      if (!hasCapability('storage') && !hasCapability('filesystem:read') && !hasCapability('filesystem:write')) {
        handleViolation('storage');
      }
      return (target as any)[prop];
    }
  });

  // --- Email Proxy ---
  const emailProxy = new Proxy(manager.email, {
    get: (target, prop) => {
      if (!hasCapability('email')) {
        handleViolation('email');
      }
      return (target as any)[prop];
    }
  });

  // --- Cache Proxy ---
  const cachePrefix = `cache:${plugin.manifest.slug}:`;
  const cacheProxy = {
    get: (key: string) => {
      if (!hasCapability('cache')) handleViolation('cache');
      return manager.cache.get(`${cachePrefix}${key}`);
    },
    set: (key: string, value: any, ttl?: number) => {
      if (!hasCapability('cache')) handleViolation('cache');
      return manager.cache.set(`${cachePrefix}${key}`, value, ttl);
    },
    del: (key: string) => {
      if (!hasCapability('cache')) handleViolation('cache');
      return manager.cache.del(`${cachePrefix}${key}`);
    }
  };

  // --- Redis Proxy with Prefixing ---
  const redisPrefix = `redis:${plugin.manifest.slug}:`;
  const redisProxy = new Proxy(manager.jobs.redis, {
    get: (target, prop) => {
      if (prop === 'global') {
        if (!hasCapability('redis:global')) handleViolation('redis:global');
        return target;
      }

      const original = (target as any)[prop];
      if (typeof original === 'function') {
        return (...args: any[]) => {
          if (!hasCapability('jobs') && !hasCapability('cache')) {
            handleViolation('jobs');
          }

          const keyCommands = [
            'get', 'set', 'del', 'exists', 'expire', 'ttl', 'incr', 'decr',
            'hget', 'hset', 'hdel', 'hgetall', 'hexists', 'hincrby',
            'lpush', 'rpush', 'lpop', 'rpop', 'lrange', 'lrem', 'lset',
            'sadd', 'srem', 'smembers', 'sismember', 'scard',
            'zadd', 'zrem', 'zrange', 'zrevrange', 'zcard', 'zscore'
          ];

          if (typeof prop === 'string' && keyCommands.includes(prop.toLowerCase())) {
            if (args.length > 0 && typeof args[0] === 'string') {
              args[0] = `${redisPrefix}${args[0]}`;
            }
          }
          return original.apply(target, args);
        };
      }
      return original;
    }
  });

  const ctx: PluginContext = {
    db: dbProxy as any,
    api,
    hooks: hooksProxy,
    auth: manager.auth || {
      hashPassword: () => { throw new Error('Auth service not initialized'); },
      comparePassword: () => { throw new Error('Auth service not initialized'); },
      generateToken: () => { throw new Error('Auth service not initialized'); },
      verifyToken: () => { throw new Error('Auth service not initialized'); },
    },
    cache: cacheProxy as any,
    storage: storageProxy,
    email: emailProxy,
    redis: redisProxy,
    jobs: {
      enqueue: (name: string, data: any, options?: any) => {
        if (!hasCapability('jobs')) handleViolation('jobs');
        // Auto-prefix queue with plugin slug for isolation
        return manager.jobs.addJob(plugin.manifest.slug, name, data, options);
      },
      add: (name: string, data: any, options?: any) => {
        if (!hasCapability('jobs')) handleViolation('jobs');
        return manager.jobs.addJob(plugin.manifest.slug, name, data, options);
      },
      worker: (processor: (job: any) => Promise<any>, options?: any) => {
        if (!hasCapability('jobs')) handleViolation('jobs');
        return manager.jobs.registerWorker(plugin.manifest.slug, processor, options);
      }
    },
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
        if (!hasCapability('plugins:interact')) handleViolation('plugins:interact');
        return manager.plugins.get(slug)?.state === 'active';
      },
      getAPI: (slug: string) => {
        if (!hasCapability('plugins:interact')) handleViolation('plugins:interact');
        return manager.plugins.get(slug)?.publicAPI;
      },
      emit: (event: string, data: any) => {
        if (!hasCapability('hooks')) handleViolation('hooks');
        manager.emit(event, data);
      },
      on: (event: string, handler: any) => {
        if (!hasCapability('hooks')) handleViolation('hooks');
        return manager.hooks.on(event, handler);
      },
    },
    collections: {
      register: (collection: Collection) => {
        if (!hasCapability('database') && !hasCapability('content')) {
          handleViolation('content');
        }

        // Automatically prefix plugin collections for isolation and security
        // We preserve the human-friendly identifier (shortSlug) if provided,
        // otherwise we use the technical slug provided by the plugin.
        const inputSlug = collection.slug;
        const shortSlug = collection.shortSlug || inputSlug;
        const prefixedSlug = `${tablePrefix}${inputSlug}`;
        
        const modifiedCollection: Collection = {
          ...collection,
          slug: prefixedSlug,
          shortSlug,
          unprefixedSlug: inputSlug,
          pluginSlug: plugin.manifest.slug,
          // Keep pretty name if not provided
          name: collection.name || shortSlug.charAt(0).toUpperCase() + shortSlug.slice(1)
        };

        rootLogger.info(`Plugin "${plugin.manifest.slug}" registered collection "${inputSlug}" as "${prefixedSlug}" (shortSlug: ${shortSlug})`);

        const existing = manager.registeredCollections.get(prefixedSlug);
        if (existing) {
          rootLogger.info(`Merging fields for collection "${prefixedSlug}" from plugin "${plugin.manifest.slug}"`);
          const fieldNames = new Set(existing.collection.fields.map(f => f.name));
          for (const field of modifiedCollection.fields) {
            if (!fieldNames.has(field.name)) {
              existing.collection.fields.push(field);
            }
          }
        } else {
          manager.registeredCollections.set(prefixedSlug, {
            collection: modifiedCollection,
            pluginSlug: plugin.manifest.slug
          });
        }
      }
    },
    i18n: {
      translate: (key: string, params: any, locale: any) => {
        if (!hasCapability('i18n')) handleViolation('i18n');
        return manager.i18n.translate(key, params, locale);
      },
      t: (key: string, params?: Record<string, any>) => {
        if (!hasCapability('i18n')) handleViolation('i18n');
        return manager.i18n.translate(`${plugin.manifest.slug}.${key}`, params);
      },
      registerTranslations: (locale: string, translations: any) => {
        if (!hasCapability('i18n')) handleViolation('i18n');
        manager.i18n.registerTranslations(locale, plugin.manifest.slug, translations as TranslationMap);
      }
    },
    t: (key: string, params?: Record<string, any>) => {
      if (!hasCapability('i18n')) handleViolation('i18n');
      return manager.i18n.translate(`${plugin.manifest.slug}.${key}`, params);
    },
    ui: {
      registerHeadInjection: (injection: any) => {
        const slug = plugin.manifest.slug;
        const injections = manager.headInjections.get(slug) || [];

        const existingIndex = injections.findIndex(inj => {
          if (inj.tag !== injection.tag) return false;
          if (injection.props.id && inj.props.id === injection.props.id) return true;
          if (injection.props.name && inj.props.name === injection.props.name) return true;
          if (injection.props.src && inj.props.src === injection.props.src) return true;
          if (injection.props.href && inj.props.href === injection.props.href) return true;
          return false;
        });

        if (existingIndex >= 0) {
          injections[existingIndex] = injection;
        } else {
          injections.push(injection);
        }
        manager.headInjections.set(slug, injections);
      }
    },
    runtime: {
      registerModule: (name: string, config: { keys: string[], type: 'icon' | 'lib' }) => {
        manager.runtime.registerModule(name, config);
        rootLogger.info(`Plugin "${plugin.manifest.slug}" registered runtime module bridge: ${name} (${config.type})`);
      }
    }
  };

  pluginLogger.debug(`Context created for ${plugin.manifest.slug}. Keys: ${Object.keys(ctx).join(', ')}`);
  return ctx;
}
