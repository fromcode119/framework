import { 
  PluginContext, 
  LoadedPlugin, 
  Collection, 
  TranslationMap,
  PluginManifest,
  MiddlewareConfig
} from '../types';
import { Logger } from '../logging/logger';
import { sql, count, eq, and, or } from 'drizzle-orm';
import { PluginPermissionsService } from '../security/permissions';
import { RateLimiter } from '../security/rate-limiter';
import { MiddlewareManager } from './services/MiddlewareManager';

// Shared rate limiters for plugins
const dbLimiter = new RateLimiter(5000, 60000); // 5000 queries per minute
const apiLimiter = new RateLimiter(1000, 60000); // 1000 registrations per minute

/**
 * Interface representing the necessary parts of PluginManager 
 * required to construct a PluginContext.
 */
export interface PluginManagerInterface {
  hooks: any;
  apiHost: any;
  db: any;
  audit: any;
  storage: any;
  email: any;
  cache: any;
  jobs: any;
  scheduler: any;
  redis?: any;
  auth: any;
  i18n: any;
  middlewares: MiddlewareManager;
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
  registerPluginSettings(pluginSlug: string, schema: any): void;
  getPluginSettings(pluginSlug: string): any | undefined;
  installFromZip(filePath: string, pluginsRoot?: string): Promise<PluginManifest>;
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
    manager.audit.logAction(plugin.manifest.slug, 'Capability Check', cap, 'violation');
    manager.disableWithError(plugin.manifest.slug, `Security Violation: Missing "${cap}" capability.`);
    throw new Error(`Security Violation: Missing "${cap}" capability.`);
  };

  const handleRateLimit = (type: string) => {
    rootLogger.warn(`Rate Limit Exceeded: Plugin "${plugin.manifest.slug}" reached ${type} quota.`);
    manager.audit.logAction(plugin.manifest.slug, 'Rate Limit', type, 'denied');
    throw new Error(`Rate Limit Exceeded: Plugin "${plugin.manifest.slug}" reached ${type} quota.`);
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

    if (!apiLimiter.check(plugin.manifest.slug)) {
      handleRateLimit('API Registration');
    }

    // Security: Prevent path traversal attempts
    if (path.includes('..')) {
      throw new Error(`Security Violation: Plugin "${plugin.manifest.slug}" attempted invalid API path: ${path}`);
    }

    // Paths are simplified because they are mounted on pluginRouter under /api/v1/
    // Example: path "/posts" becomes "/cms/posts" which matches /api/v1/cms/posts
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const fullPath = `/${plugin.manifest.slug}${cleanPath}`;

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
    use: createApiWrapper('use'),
    registerMiddleware: (config: MiddlewareConfig) => {
      if (!hasCapability('api')) {
        handleViolation('api');
      }

      // Wrap the handler with a check that verifies the plugin is still active
      const originalHandler = config.handler;
      config.handler = (req: any, res: any, next: any) => {
        const currentPlugin = manager.plugins.get(plugin.manifest.slug);
        if (!currentPlugin || currentPlugin.state !== 'active') {
          return next();
        }
        return originalHandler(req, res, next);
      };

      manager.middlewares.register(config);
      pluginLogger.debug(`Registered global middleware: ${config.id} (${config.stage})`);
    }
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

      const dbMethods = ['find', 'findOne', 'create', 'update', 'delete', 'execute', 'count'];
      if (typeof prop === 'string' && dbMethods.includes(prop)) {
        if (!dbLimiter.check(plugin.manifest.slug)) {
          handleRateLimit('Database');
        }

        // Audit writing operations
        if (['create', 'update', 'delete', 'execute'].includes(prop)) {
            manager.audit.logAction(plugin.manifest.slug, 'Database Write', prop, 'allowed');
        }
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

      const original = (target as any)[prop];
      if (typeof original === 'function') {
        return (...args: any[]) => {
          // Force plugin-specific directory for storage operations
          // Most storage methods take a 'path' or 'key' as first argument
          if (['upload', 'delete', 'get', 'exists', 'getUrl'].includes(prop as string)) {
            if (args.length > 0 && typeof args[0] === 'string') {
               // Ensure path doesn't escape
               const sanitizedPath = args[0].replace(/\.\./g, '');
               args[0] = `plugins/${plugin.manifest.slug}/${sanitizedPath.startsWith('/') ? sanitizedPath.slice(1) : sanitizedPath}`;
            }
          }
          return original.apply(target, args);
        };
      }
      return original;
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
  const redisTarget = manager.jobs.redis || {};
  const redisProxy = new Proxy(redisTarget, {
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

  // --- Fetch Bridge ---
  const fetchBridge = async (url: string, init?: any) => {
    if (!hasCapability('network')) {
      handleViolation('network');
    }
    
    // Log outgoing requests for auditing
    manager.audit.logAction(plugin.manifest.slug, 'Network Request', url, 'allowed');
    
    // We use global fetch (Node 18+)
    const response = await fetch(url, init);
    
    // Return a simplified response object or the actual one if it's not too complex
    // For now, let's keep it simple
    return response;
  };

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
    fetch: fetchBridge,
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
    scheduler: {
      register: async (name: string, schedule: string, handler: any, options: { type?: 'cron' | 'interval' } = {}) => {
        if (!hasCapability('scheduler')) handleViolation('scheduler');
        const fullName = `${plugin.manifest.slug}:${name}`;
        await manager.scheduler.register(fullName, schedule, handler, {
          ...options,
          plugin_slug: plugin.manifest.slug
        });
      },
      runNow: (name: string) => {
        if (!hasCapability('scheduler')) handleViolation('scheduler');
        return manager.scheduler.runTask(`${plugin.manifest.slug}:${name}`);
      },
      schedule: async (name: string, when: Date | string, data: any) => {
        if (!hasCapability('scheduler') && !hasCapability('jobs')) handleViolation('scheduler');
        
        // This is where Jobs and Scheduler intersect
        // A scheduled task is effectively a delayed job
        const delay = new Date(when).getTime() - Date.now();
        if (delay <= 0) {
          return manager.jobs.addJob(plugin.manifest.slug, name, data);
        } else {
          return manager.jobs.addJob(plugin.manifest.slug, name, data, { delay });
        }
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
        const tablePrefix = `fcp_${plugin.manifest.slug.replace(/-/g, '_')}_`;
        const inputSlug = collection.slug;
        
        // If the slug already has the prefix (e.g. manually added), don't add it again
        const prefixedSlug = inputSlug.startsWith(tablePrefix) ? inputSlug : `${tablePrefix}${inputSlug}`;

        if (inputSlug.startsWith(plugin.manifest.slug) || inputSlug.startsWith('fcp_')) {
          rootLogger.warn(
            `Collection slug "${inputSlug}" in plugin "${plugin.manifest.slug}" may be redundantly prefixed. ` +
            `The framework automatically handles table prefixing (final table: ${prefixedSlug}). ` +
            `Recommendation: use a primitive slug like "${inputSlug.replace(plugin.manifest.slug, '').replace(/^[_-]/, '') || 'posts'}".`
          );
        }
        
        const shortSlug = collection.shortSlug || (inputSlug.startsWith(tablePrefix) ? inputSlug.replace(tablePrefix, '') : inputSlug);
        
        const modifiedCollection: Collection = {
          ...collection,
          slug: prefixedSlug,
          shortSlug,
          unprefixedSlug: inputSlug,
          pluginSlug: plugin.manifest.slug,
          // Keep pretty name if not provided
          name: collection.name || shortSlug.charAt(0).toUpperCase() + shortSlug.slice(1)
        };

        // Add auto-generated fields for workflow and versions if enabled
        if (modifiedCollection.workflow) {
          if (!modifiedCollection.fields.find(f => f.name === 'status')) {
             modifiedCollection.fields.push({
               name: 'status',
               type: 'select',
               label: 'Status',
               defaultValue: 'draft',
               options: [
                 { label: 'Draft', value: 'draft' },
                 { label: 'In Review', value: 'review' },
                 { label: 'Published', value: 'published' }
               ],
               admin: {
                 position: 'sidebar',
                 section: 'Review Process'
               }
             } as any);
          }

          if (!modifiedCollection.fields.find(f => f.name === 'publishedAt')) {
            modifiedCollection.fields.push({
              name: 'publishedAt',
              type: 'datetime',
              label: 'Published Date',
              admin: {
                position: 'sidebar',
                section: 'Review Process',
                description: 'The date this content was officially published.'
              }
            } as any);
          }

          if (!modifiedCollection.fields.find(f => f.name === 'scheduledPublishAt')) {
            modifiedCollection.fields.push({
              name: 'scheduledPublishAt',
              type: 'datetime',
              label: 'Schedule Release',
              admin: {
                position: 'sidebar',
                section: 'Review Process',
                description: 'Automatically set status to Published at this date/time.'
              }
            } as any);
          }
        }

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

        // Emit hook to allow other plugins to augment this collection
        manager.emit('collection:registered', { 
          collection: manager.registeredCollections.get(prefixedSlug)?.collection, 
          pluginSlug: plugin.manifest.slug 
        });
      },
      extend: (targetPlugin: string, targetCollection: string, extensions: Partial<Collection>) => {
        const tablePrefix = `fcp_${targetPlugin.replace(/-/g, '_')}_`;
        const fullSlug = `fcp_${targetPlugin.replace(/-/g, '_')}_${targetCollection}`;
        
        const entry = manager.getCollection(fullSlug);
        if (entry) {
          if (extensions.fields) {
            const existingNames = new Set(entry.collection.fields.map(f => f.name));
            extensions.fields.forEach(f => {
              if (!existingNames.has(f.name)) {
                entry.collection.fields.push(f);
              }
            });
          }
          rootLogger.info(`Plugin "${plugin.manifest.slug}" extended collection "${fullSlug}"`);
        } else {
          // If the collection isn't registered yet, we queue the extension for when it is
          manager.hooks.on('collection:registered', (data: any) => {
             if (data.pluginSlug === targetPlugin && data.collection.shortSlug === targetCollection) {
                if (extensions.fields) {
                  const existingNames = new Set(data.collection.fields.map(f => f.name));
                  extensions.fields.forEach((f: any) => {
                    if (!existingNames.has(f.name)) {
                      data.collection.fields.push(f);
                    }
                  });
                }
                rootLogger.info(`Plugin "${plugin.manifest.slug}" applied delayed extension to collection "${fullSlug}"`);
             }
          });
        }
      }
    },
    settings: {
      register: (schema: any) => {
        manager.registerPluginSettings(plugin.manifest.slug, schema);
      },
      get: async () => {
        const stored = await manager.db.findOne('_system_plugin_settings', { plugin_slug: plugin.manifest.slug });
        const storedSettings = stored?.settings?.settings || {};
        const schema = manager.getPluginSettings(plugin.manifest.slug);
        
        if (schema && schema.fields) {
          const defaults: Record<string, any> = {};
          schema.fields.forEach((field: any) => {
            if (field.defaultValue !== undefined) {
              defaults[field.name] = field.defaultValue;
            }
          });
          return { ...defaults, ...storedSettings };
        }
        return storedSettings;
      },
      update: async (values: Record<string, any>) => {
        const stored = await manager.db.findOne('_system_plugin_settings', { plugin_slug: plugin.manifest.slug });
        const currentConfig = stored?.settings || {};
        
        await manager.savePluginConfig(plugin.manifest.slug, {
          ...currentConfig,
          settings: values
        });
        
        manager.emit('plugin:settings:updated', {
          pluginSlug: plugin.manifest.slug,
          settings: values
        });
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
