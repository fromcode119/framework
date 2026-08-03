
import { Logger } from '@core/logging';
import { IQueueAdapter } from '@core/queue/interfaces/queue-adapter.interface';
import { QueueAdapterFactory } from '@core/queue/queue-adapter-factory';
import type { IQueueOptions } from '@core/queue/interfaces/queue-options.interface';

export class QueueManager {
  private adapter: IQueueAdapter;
  private logger = new Logger({ namespace: 'queue-manager' });

  constructor(options: IQueueOptions = {}) {
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