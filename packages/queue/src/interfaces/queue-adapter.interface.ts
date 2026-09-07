import type { QueueSettings } from '@queue/queue-settings';

export interface IQueueAdapter {
  /** Take the operator's job policy. The in-memory adapter has nothing to do with it. */
  applySettings(settings: QueueSettings): void;
  addJob(queueName: string, name: string, data: any, options?: any): Promise<any>;
  registerWorker(queueName: string, processor: (job: any) => Promise<any>, options?: any): void;
  close(): Promise<void>;
}
