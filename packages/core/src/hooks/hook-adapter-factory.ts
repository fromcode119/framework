import { IHookMessagingAdapter } from '@core/hooks/interfaces/hook-messaging-adapter.interface';
import { LocalHookAdapter } from '@core/hooks/adapters/local-hook-adapter';
import type { IHookAdapterCreator } from '@core/hooks/interfaces/hook-adapter-creator.interface';

export class HookAdapterFactory {
  private static registry: Map<string, IHookAdapterCreator> = new Map();

  static register(type: string, creator: IHookAdapterCreator) {
    this.registry.set(type, creator);
  }

  static create(type?: string, options: { redisUrl?: string, namespace?: string } = {}): IHookMessagingAdapter {
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