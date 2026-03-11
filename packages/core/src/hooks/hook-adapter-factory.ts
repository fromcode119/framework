import { HookMessagingAdapter } from './types';
import { LocalHookAdapter } from './adapters/local-hook-adapter';
import type { HookAdapterCreator } from './hook-adapter-factory.types';

export class HookAdapterFactory {
  private static registry: Map<string, HookAdapterCreator> = new Map();

  static register(type: string, creator: HookAdapterCreator) {
    this.registry.set(type, creator);
  }

  static create(type?: string, options: { redisUrl?: string, namespace?: string } = {}): HookMessagingAdapter {
    const requested = type || (options.redisUrl || (typeof process !== 'undefined' && process.env.REDIS_URL) ? 'redis' : 'local');
    const creator = this.registry.get(requested);
    
    if (creator) {
      try {
        return creator(options);
      } catch (err) {
        console.warn(`[Hooks] Adapter "${requested}" failed to initialize. Falling back to local.`);
      }
    }

    return new LocalHookAdapter();
  }
}