// TypeScript namespace import correctly handles isolated-vm's CommonJS export pattern
import * as ivm from 'isolated-vm';
import { PluginManifest, PluginContext } from '../types';
import { Logger } from '../logging';

export class SandboxManager {
  private logger = new Logger({ namespace: 'sandbox-manager' });
  private isolate: any; // ivm.Isolate
  private contexts: Map<string, any> = new Map(); // ivm.Context
  private limits: Map<string, { timeout?: number; memory?: number }> = new Map();

  constructor(private memoryLimit: number = 128) {
    this.isolate = new ivm.Isolate({ memoryLimit: this.memoryLimit });
  }

  /**
   * Initializes a persistent context for a plugin.
   */
  public async initPluginContext(slug: string, ctx: PluginContext, manifest?: PluginManifest): Promise<any> { // ivm.Context
    if (this.contexts.has(slug)) {
      this.contexts.get(slug)?.release();
    }

    // Store limits if provided in manifest
    if (manifest?.sandbox && typeof manifest.sandbox === 'object') {
      this.limits.set(slug, {
        timeout: manifest.sandbox.timeout,
        memory: manifest.sandbox.memoryLimit
      });
    }

    const ivmContext = await this.isolate.createContext();
    await this.applyPluginContext(ivmContext, ctx);
    this.contexts.set(slug, ivmContext);
    return ivmContext;
  }

  /**
   * Runs a script within a plugin's persistent context.
   */
  public async runInPluginContext(slug: string, code: string): Promise<any> {
    const ivmContext = this.contexts.get(slug);
    if (!ivmContext) {
      throw new Error(`No sandbox context found for plugin "${slug}". Initialize it first.`);
    }

    try {
      const script = await this.isolate.compileScript(code);
      const limit = this.limits.get(slug);
      
      return await script.run(ivmContext, { 
        promise: true, 
        copy: true,
        timeout: limit?.timeout || 1000 // Default 1 second timeout
      });
    } catch (error: any) {
      this.logger.error(`Sandbox Script Error in plugin "${slug}": ${error.message}`);
      throw error;
    }
  }

  /**
   * Returns current isolate health and resource usage.
   */
  public async getStats() {
    const heap = await this.isolate.getHeapStatistics();
    return {
      activeContexts: this.contexts.size,
      memoryLimit: this.memoryLimit,
      heap: {
        total_heap_size: heap.total_heap_size,
        total_heap_size_executable: heap.total_heap_size_executable,
        total_physical_size: heap.total_physical_size,
        total_available_size: heap.total_available_size,
        used_heap_size: heap.used_heap_size,
        heap_size_limit: heap.heap_size_limit,
        malloced_memory: heap.malloced_memory,
        peak_malloced_memory: heap.peak_malloced_memory,
        externally_allocated_size: heap.externally_allocated_size,
      }
    };
  }

  /**
   * Disposes of a plugin's context (e.g., when disabling).
   */
  public disposePluginContext(slug: string) {
    const ivmContext = this.contexts.get(slug);
    if (ivmContext) {
      ivmContext.release();
      this.contexts.delete(slug);
    }
  }

  /**
   * Creates a secure bridge for the PluginContext into the isolate.
   */
  public async applyPluginContext(ivmContext: any /* ivm.Context */, ctx: PluginContext) {
    const jail = ivmContext.global;

    // 1. Basic Plugin Info
    await jail.set('plugin', new ivm.ExternalCopy({
      slug: ctx.plugin.slug,
      version: ctx.plugin.version,
      config: ctx.plugin.config || {},
      dataDir: ctx.plugin.dataDir
    }).copyInto());

    // 2. Logger Bridge
    await jail.set('_log_bridge', new ivm.Reference((level: string, msg: string) => {
      if (level === 'info') ctx.logger.info(msg);
      else if (level === 'warn') ctx.logger.warn(msg);
      else if (level === 'error') ctx.logger.error(msg);
    }));

    await ivmContext.evalClosure(`
      if (!globalThis.global) globalThis.global = globalThis;
      globalThis.logger = {
        info: (msg) => _log_bridge.apply(undefined, ['info', msg]),
        warn: (msg) => _log_bridge.apply(undefined, ['warn', msg]),
        error: (msg) => _log_bridge.apply(undefined, ['error', msg]),
      };
      globalThis.console = {
        log: (...args) => _log_bridge.apply(undefined, ['info', args.join(' ')]),
        info: (...args) => _log_bridge.apply(undefined, ['info', args.join(' ')]),
        warn: (...args) => _log_bridge.apply(undefined, ['warn', args.join(' ')]),
        error: (...args) => _log_bridge.apply(undefined, ['error', args.join(' ')]),
      };
    `, [], { arguments: { reference: true } });

    // 3. Database Bridge (Agnostic Methods)
    if (ctx.db) {
      await jail.set('_db_find', new ivm.Reference(async (collection: string, query: any) => {
        return await ctx.db.find(collection, query);
      }));
      await jail.set('_db_findOne', new ivm.Reference(async (collection: string, query: any) => {
        return await ctx.db.findOne(collection, query);
      }));
      await jail.set('_db_insert', new ivm.Reference(async (collection: string, data: any) => {
        return await ctx.db.insert(collection, data);
      }));
      await jail.set('_db_update', new ivm.Reference(async (collection: string, where: any, data: any) => {
        return await ctx.db.update(collection, where, data);
      }));
      await jail.set('_db_delete', new ivm.Reference(async (collection: string, where: any) => {
        return await ctx.db.delete(collection, where);
      }));
      
      await ivmContext.evalClosure(`
        globalThis.db = {
          find: (collection, query) => _db_find.apply(undefined, [collection, query], { arguments: { copy: true }, result: { promise: true, copy: true } }),
          findOne: (collection, query) => _db_findOne.apply(undefined, [collection, query], { arguments: { copy: true }, result: { promise: true, copy: true } }),
          insert: (collection, data) => _db_insert.apply(undefined, [collection, data], { arguments: { copy: true }, result: { promise: true, copy: true } }),
          update: (collection, where, data) => _db_update.apply(undefined, [collection, where, data], { arguments: { copy: true }, result: { promise: true, copy: true } }),
          delete: (collection, where) => _db_delete.apply(undefined, [collection, where], { arguments: { copy: true }, result: { promise: true, copy: true } })
        };
      `, [], { arguments: { reference: true } });
    }

    // 4. Cache Bridge
    await jail.set('_cache_get', new ivm.Reference(async (key: string) => {
      const cache = ctx.cache;
      return await cache.get(key);
    }));
    await jail.set('_cache_set', new ivm.Reference(async (key: string, val: any, ttl?: number) => {
      const cache = ctx.cache;
      return await cache.set(key, val, ttl);
    }));
    await jail.set('_cache_del', new ivm.Reference(async (key: string) => {
      const cache = ctx.cache;
      return await cache.del(key);
    }));

    await ivmContext.evalClosure(`
      globalThis.cache = {
        get: (key) => _cache_get.apply(undefined, [key], { result: { promise: true, copy: true } }),
        set: (key, val, ttl) => _cache_set.apply(undefined, [key, val, ttl], { arguments: { copy: true }, result: { promise: true } }),
        del: (key) => _cache_del.apply(undefined, [key], { result: { promise: true } })
      };
    `, [], { arguments: { reference: true } });

    // 5. Plugins & Hooks Bridge
    await jail.set('_plugins_isEnabled', new ivm.Reference((slug: string) => ctx.plugins.isEnabled(slug)));
    await jail.set('_plugins_emit', new ivm.Reference((event: string, data: any) => ctx.plugins.emit(event, data)));
    
    // Hooks/Events are tricky: we need to allow the sandbox to register a listener
    // and then call back INTO the sandbox when the event fires.
    await jail.set('_plugins_on', new ivm.Reference((event: string, callback: any /* ivm.Reference */) => {
      ctx.plugins.on(event, async (payload: any) => {
        try {
          await callback.apply(undefined, [new ivm.ExternalCopy(payload).copyInto()], { arguments: { copy: true } });
        } catch (e: any) {
          this.logger.error(`Error in sandboxed event listener (${event}): ${e.message}`);
        }
      });
    }));

    await ivmContext.evalClosure(`
      globalThis.plugins = {
        isEnabled: (slug) => _plugins_isEnabled.apply(undefined, [slug]),
        emit: (event, data) => _plugins_emit.apply(undefined, [event, data], { arguments: { copy: true } }),
        on: (event, callback) => _plugins_on.apply(undefined, [event, callback], { arguments: { reference: true } })
      };
    `, [], { arguments: { reference: true } });

    // 6. API Bridge
    await jail.set('_api_register', new ivm.Reference((method: string, path: string, callback: any /* ivm.Reference */) => {
      (ctx.api as any)[method](path, async (req: any, res: any) => {
        try {
          // req/res are too complex to bridge directly, so we pass a simplified req
          const simpleReq = {
            params: req.params,
            query: req.query,
            body: req.body,
            headers: req.headers,
            method: req.method,
            url: req.url
          };
          
          const result = await callback.apply(undefined, [new ivm.ExternalCopy(simpleReq).copyInto()], { 
            arguments: { copy: true },
            result: { promise: true, copy: true } 
          });
          
          if (result && typeof result === 'object') {
            res.json(result);
          } else {
            res.send(result);
          }
        } catch (e: any) {
          this.logger.error(`Error in sandboxed API handler (${method} ${path}): ${e.message}`);
          res.status(500).json({ error: 'Sandbox internal error' });
        }
      });
    }));

    await ivmContext.evalClosure(`
      globalThis.api = {
        get: (path, cb) => _api_register.apply(undefined, ['get', path, cb], { arguments: { reference: true } }),
        health: (cb) => _api_register.apply(undefined, ['get', '/health', cb], { arguments: { reference: true } }),
        post: (path, cb) => _api_register.apply(undefined, ['post', path, cb], { arguments: { reference: true } }),
        put: (path, cb) => _api_register.apply(undefined, ['put', path, cb], { arguments: { reference: true } }),
        delete: (path, cb) => _api_register.apply(undefined, ['delete', path, cb], { arguments: { reference: true } }),
        patch: (path, cb) => _api_register.apply(undefined, ['patch', path, cb], { arguments: { reference: true } }),
        status: (cb) => _api_register.apply(undefined, ['get', '/status', cb], { arguments: { reference: true } })
      };
    `, [], { arguments: { reference: true } });

    // 7. Fetch Bridge
    if (ctx.fetch) {
      await jail.set('_fetch_bridge', new ivm.Reference(async (url: string, init?: any) => {
        const response = await ctx.fetch(url, init);
        return {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries()),
          body: await response.text() // For simplicity, we pass body as text
        };
      }));

      await ivmContext.evalClosure(`
        globalThis.fetch = async (url, init) => {
          const res = await _fetch_bridge.apply(undefined, [url, init], { 
            arguments: { copy: true }, 
            result: { promise: true, copy: true } 
          });
          return {
            ...res,
            json: async () => JSON.parse(res.body),
            text: async () => res.body
          };
        };
      `, [], { arguments: { reference: true } });
    }
  }

  public async runScript(code: string, ctx: PluginContext): Promise<any> {
    const ivmContext = await this.isolate.createContext();
    try {
      await this.applyPluginContext(ivmContext, ctx);
      const script = await this.isolate.compileScript(code);
      return await script.run(ivmContext, { promise: true, copy: true });
    } catch (error: any) {
      this.logger.error(`Sandbox Script Error in plugin "${ctx.plugin.slug}": ${error.message}`);
      throw error;
    } finally {
      ivmContext.release();
    }
  }

  public dispose() {
    this.isolate.dispose();
  }
}