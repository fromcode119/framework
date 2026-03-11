import type { Queue, Job } from 'bull';
import { QueueAdapter } from '../types';

export class BullQueueAdapter implements QueueAdapter {
  private queues: Map<string, Queue> = new Map();
  private redisUrl: string;
  private namespace: string;

  constructor(redisUrl: string, namespace?: string) {
    this.redisUrl = redisUrl;
    this.namespace = namespace || 'fromcode';
  }

  private getQueue(name: string): Queue {
    if (!this.queues.has(name)) {
      const Bull = require('bull');
      const url = new URL(this.redisUrl);
      this.queues.set(name, new Bull(name, {
        redis: {
          host: url.hostname,
          port: parseInt(url.port) || 6379,
          password: url.password || undefined,
          maxRetriesPerRequest: null,
          enableReadyCheck: false
        },
        prefix: `${this.namespace}:queue`
      }));
    }
    return this.queues.get(name)!;
  }

  async addJob(queueName: string, name: string, data: any, options: any = {}): Promise<any> {
    return this.getQueue(queueName).add(name, data, options);
  }

  registerWorker(queueName: string, processor: (job: Job) => Promise<any>, options: any = {}): void {
    const queue = this.getQueue(queueName);
    queue.process('*', options.concurrency || 1, processor);
  }

  async close(): Promise<void> {
    await Promise.all(Array.from(this.queues.values()).map(q => q.close()));
  }
}