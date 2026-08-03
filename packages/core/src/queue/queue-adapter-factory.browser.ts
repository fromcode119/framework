// Light-weight QueueAdapterFactory for the browser
import { IQueueAdapter } from '@core/queue/interfaces/queue-adapter.interface';
import { LocalQueueAdapter } from '@core/queue/adapters/local-queue-adapter';
import type { IQueueAdapterCreator } from '@core/queue/interfaces/queue-adapter-creator.interface';

export class QueueAdapterFactory {
  private static registry: Map<string, IQueueAdapterCreator> = new Map();

  static register(type: string, creator: IQueueAdapterCreator) {
    this.registry.set(type, creator);
  }

  static create(type?: string, options: any = {}): IQueueAdapter {
    return new LocalQueueAdapter();
  }
}