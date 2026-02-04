import { QueueAdapter } from './types';
import { LocalQueueAdapter } from './adapters/local';
import { BullQueueAdapter } from './adapters/bull';

export class QueueAdapterFactory {
  static create(type?: string, options: { redisUrl?: string, namespace?: string } = {}): QueueAdapter {
    const targetType = type || (options.redisUrl || process.env.REDIS_URL ? 'bull' : 'local');
    
    switch (targetType) {
      case 'bull':
      case 'redis':
        return new BullQueueAdapter(options.redisUrl || process.env.REDIS_URL!, options.namespace);
      default:
        return new LocalQueueAdapter();
    }
  }
}
