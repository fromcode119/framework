import Bull, { Queue, Job } from 'bull';
import Redis from 'ioredis';
import { QueueAdapter } from '../types';

export class BullQueueAdapter implements QueueAdapter {
  private queues: Map<string, Queue> = new Map();
  private redis: Redis;
  private subscriber: Redis;
  private redisUrl: string;
  private namespace: string;

  constructor(redisUrl: string, namespace?: string) {
    this.redisUrl = redisUrl;
    this.namespace = namespace || 'fromcode';
    this.redis = new Redis(this.redisUrl, { maxRetriesPerRequest: null });
    this.subscriber = new Redis(this.redisUrl, { maxRetriesPerRequest: null });
  }

  private getQueue(name: string): Queue {
    if (!this.queues.has(name)) {
      this.queues.set(name, new Bull(name, {
        prefix: `${this.namespace}:queue`,
        createClient: (type) => {
          if (type === 'client') return this.redis;
          if (type === 'subscriber') return this.subscriber;
          return new Redis(this.redisUrl, { maxRetriesPerRequest: null });
        }
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
    await this.redis.quit();
    await this.subscriber.quit();
  }
}
