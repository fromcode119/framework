import { QueueAdapter } from './types';
import { LocalQueueAdapter } from './adapters/local-queue-adapter';
import type { QueueAdapterCreator } from './factory.types';

export class QueueAdapterFactory {
  private static registry: Map<string, QueueAdapterCreator> = new Map();

  static register(type: string, creator: QueueAdapterCreator) {
    this.registry.set(type, creator);
  }

  static create(type?: string, options: { redisUrl?: string, namespace?: string } = {}): QueueAdapter {
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