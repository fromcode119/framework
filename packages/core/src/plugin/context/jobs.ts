import { LoadedPlugin } from '../../types';
import type { PluginManagerInterface } from './utils.interfaces';
import { ContextSecurityProxy } from './utils';

export class JobsContextProxy {
  static createJobsProxy(
    plugin: LoadedPlugin,
    manager: PluginManagerInterface,
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
    plugin: LoadedPlugin,
    manager: PluginManagerInterface,
    security: ReturnType<typeof ContextSecurityProxy.createSecurityHelpers>
  ) {
    const { hasCapability, handleViolation } = security;
    const redisPrefix = `redis:${plugin.manifest.slug}:`;
    const redisTarget = (manager.jobs as any).redis || {};
    return new Proxy(redisTarget, {
      get: (target: any, prop: string) => {
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
  }
}