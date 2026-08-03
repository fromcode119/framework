import { IQueueAdapter } from '@core/queue/interfaces/queue-adapter.interface';
import { LocalQueueAdapter } from '@core/queue/adapters/local-queue-adapter';
import type { IQueueAdapterCreator } from '@core/queue/interfaces/queue-adapter-creator.interface';

export class QueueAdapterFactory {
  private static registry: Map<string, IQueueAdapterCreator> = new Map();

  static register(type: string, creator: IQueueAdapterCreator) {
    this.registry.set(type, creator);
  }

  static create(type?: string, options: { redisUrl?: string, namespace?: string } = {}): IQueueAdapter {
    const requested = type || (options.redisUrl || (typeof process !== 'undefined' && process.env.REDIS_URL) ? 'bull' : 'local');
    const creator = this.registry.get(requested);
    
    if (creator) {
      try {
        return creator(options);
      } catch (err) {
        console.warn(`[Queue] Adapter "${requested}" failed to initialize. Falling back to local.`);
      }
    }

    return new LocalQueueAdapter();
  }
}