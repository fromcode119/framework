import { Logger } from '../logging/logger';
import { QueueAdapter } from './types';
import { QueueAdapterFactory } from './factory';

export interface QueueOptions {
  type?: string;
  redisUrl?: string;
  namespace?: string;
}

export class QueueManager {
  private adapter: QueueAdapter;
  private logger = new Logger({ namespace: 'QueueManager' });

  constructor(options: QueueOptions = {}) {
    this.adapter = QueueAdapterFactory.create(options.type, options);
  }

  async addJob(queueName: string, name: string, data: any, options: any = {}) {
    return this.adapter.addJob(queueName, name, data, options);
  }

  registerWorker(queueName: string, processor: (job: any) => Promise<any>, options: any = {}) {
    return this.adapter.registerWorker(queueName, processor, options);
  }

  async close() {
    this.logger.info('Shutting down QueueManager...');
    await this.adapter.close();
  }
}
