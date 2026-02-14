// Light-weight QueueAdapterFactory for the browser
import { QueueAdapter } from './types';
import { LocalQueueAdapter } from './adapters/local-queue-adapter';

export type QueueAdapterCreator = (options: any) => QueueAdapter;

export class QueueAdapterFactory {
  private static registry: Map<string, QueueAdapterCreator> = new Map();

  static register(type: string, creator: QueueAdapterCreator) {
    this.registry.set(type, creator);
  }

  static create(type?: string, options: any = {}): QueueAdapter {
    return new LocalQueueAdapter();
  }
}
