import { HookMessagingAdapter } from './types';
import { LocalHookAdapter } from './adapters/local';
import { RedisHookAdapter } from './adapters/redis';

export class HookAdapterFactory {
  static create(type?: string, options: { redisUrl?: string, namespace?: string } = {}): HookMessagingAdapter {
    const targetType = type || (options.redisUrl || process.env.REDIS_URL ? 'redis' : 'local');
    
    switch (targetType) {
      case 'redis':
        return new RedisHookAdapter(options.redisUrl || process.env.REDIS_URL!, options.namespace);
      default:
        return new LocalHookAdapter();
    }
  }
}
