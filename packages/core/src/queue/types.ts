import { Job } from 'bull';

export interface QueueAdapter {
  addJob(queueName: string, name: string, data: any, options?: any): Promise<any>;
  registerWorker(queueName: string, processor: (job: any) => Promise<any>, options?: any): void;
  close(): Promise<void>;
}
