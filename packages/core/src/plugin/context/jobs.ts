import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import { ContextSecurityProxy } from '@core/plugin/context/utils';
import { PluginKeyspace } from '@core/plugin/context/plugin-keyspace';

export class JobsContextProxy {
  /** Commands that touch exactly the one key in their first argument. */
  private static readonly KEYED_COMMANDS = new Set([
    'get', 'set', 'del', 'exists', 'expire', 'ttl', 'incr', 'decr',
    'hget', 'hset', 'hdel', 'hgetall', 'hexists', 'hincrby',
    'lpush', 'rpush', 'lpop', 'rpop', 'lrange', 'lrem', 'lset',
    'sadd', 'srem', 'smembers', 'sismember', 'scard',
    'zadd', 'zrem', 'zrange', 'zrevrange', 'zcard', 'zscore',
  ]);

  static createJobsProxy(
    plugin: ILoadedPlugin,
    manager: IPluginManagerInterface,
    security: ReturnType<typeof ContextSecurityProxy.createSecurityHelpers>
  ) {
    const { hasCapability, handleViolation } = security;
    return {
      add: (name: string, data: any, options?: any) => {
        if (!hasCapability('jobs')) handleViolation('jobs');
        return manager.jobs.addJob(plugin.manifest.slug, name, data, options);
      },
      worker: (processor: any, options?: any) => {
        if (!hasCapability('jobs')) handleViolation('jobs');
        return manager.jobs.registerWorker(plugin.manifest.slug, processor, options);
      }
    };
  }

  static createRedisProxy(
    plugin: ILoadedPlugin,
    manager: IPluginManagerInterface,
    security: ReturnType<typeof ContextSecurityProxy.createSecurityHelpers>
  ) {
    const { hasCapability, handleViolation } = security;
    const slug = plugin.manifest.slug;
    const redisTarget = (manager.jobs as any).redis || {};
    return new Proxy(redisTarget, {
      // A Proxy `get` trap can be invoked with a symbol (e.g. `Symbol.iterator`), not just a string,
      // despite the narrower parameter type below — the check is real, not decorative.
      get: (target: any, prop: string | symbol) => {
        if (prop === 'global') {
          if (!hasCapability('redis:global')) handleViolation('redis:global');
          return target;
        }
        const original = target[prop];
        if (typeof original === 'function') {
          return (...args: any[]) => {
            if (!hasCapability('jobs') && !hasCapability('cache')) {
              handleViolation('jobs');
            }
            const command = typeof prop === 'string' ? prop.toLowerCase() : '';
            // Only commands whose FIRST argument is the one key they touch can be confined to this
            // plugin's keyspace. Everything else — `keys`, `scan`, `mget`, `eval`, `flushdb` — names
            // other keys or none, and ran unprefixed against the shared redis: every site's entries,
            // every plugin's, the queue's. Those need the global capability, like `.global` does.
            if (!JobsContextProxy.KEYED_COMMANDS.has(command)) {
              if (!hasCapability('redis:global')) handleViolation('redis:global');
              return original.apply(target, args);
            }
            if (args.length > 0 && typeof args[0] === 'string') {
              // Per SITE as well as per plugin — see PluginKeyspace.
              args[0] = `${PluginKeyspace.prefix('redis', slug)}${args[0]}`;
            }
            return original.apply(target, args);
          };
        }
        return original;
      }
    });
  }
}