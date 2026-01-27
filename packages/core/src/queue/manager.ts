import Bull, { Queue, Job } from 'bull';
import Redis from 'ioredis';
import { Logger } from '../logging/logger';

export interface QueueOptions {
  redisUrl?: string;
  namespace?: string;
}

export class QueueManager {
  private queues: Map<string, Queue> = new Map();
  private logger = new Logger({ namespace: 'QueueManager' });
  private redisUrl: string;
  public redis: Redis; // Global redis connection for general use
  private subscriber: Redis; // Dedicated subscriber for Bull

  constructor(options: QueueOptions = {}) {
    this.redisUrl = options.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
    this.redis = new Redis(this.redisUrl, {
      maxRetriesPerRequest: null,
    });
    this.subscriber = new Redis(this.redisUrl, {
      maxRetriesPerRequest: null,
    });
    this.logger.info(`Initialized with Redis: ${this.redisUrl}`);
  }

  getQueue(name: string): Queue {
    if (!this.queues.has(name)) {
      this.queues.set(name, new Bull(name, {
        createClient: (type) => {
          switch (type) {
            case 'client':
              return this.redis;
            case 'subscriber':
              return this.subscriber;
            default:
              return new Redis(this.redisUrl, {
                maxRetriesPerRequest: null,
              });
          }
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        }
      }));
    }
    return this.queues.get(name)!;
  }

  async addJob(queueName: string, name: string, data: any, options: any = {}) {
    const queue = this.getQueue(queueName);
    // Bull v3/v4 add jobs with a name as the first argument optionally, but usually it's add(data, options)
    // and process('*', handler) or process('name', handler).
    // To match BullMQ style exactly:
    return queue.add(name, data, options);
  }

  /**
   * Registers a worker for a specific queue.
   * Plugins can use this to process background tasks.
   */
  registerWorker(queueName: string, processor: (job: Job) => Promise<any>, options: any = {}) {
    const queue = this.getQueue(queueName);
    
    // In Bull, concurrency is passed to process()
    const concurrency = options.concurrency || 1;

    queue.process('*', concurrency, async (job) => {
      return processor(job);
    });

    queue.on('completed', (job) => {
      this.logger.debug(`Job ${job.id} completed in queue ${queueName}`);
    });

    queue.on('failed', (job, err) => {
      this.logger.error(`Job ${job.id} failed in queue ${queueName}: ${err.message}`);
    });

    queue.on('error', (err) => {
      this.logger.error(`Queue ${queueName} encountered an error: ${err.message}`);
    });

    return queue;
  }

  async close() {
    this.logger.info('Shutting down QueueManager...');
    await Promise.all(
      Array.from(this.queues.values()).map(q => q.close())
    );
    await this.redis.quit();
    await this.subscriber.quit();
  }
}
