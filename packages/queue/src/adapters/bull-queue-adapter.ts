import type { ConnectionOptions, Job, Queue, Worker } from 'bullmq';
import { IQueueAdapter } from '@queue/interfaces/queue-adapter.interface';
import { QueueSettings } from '@queue/queue-settings';

export class BullQueueAdapter implements IQueueAdapter {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private connection: ConnectionOptions;
  private namespace: string;
  private settings: QueueSettings;
  private onFailure: (queue: string, jobId: string, error: Error) => void;

  constructor(
    redisUrl: string,
    namespace?: string,
    settings: QueueSettings = QueueSettings.defaults(),
    onFailure?: (queue: string, jobId: string, error: Error) => void,
  ) {
    // Parsed here rather than at the first job: an unusable URL must fail while the caller can still
    // report it, not hours later inside a worker nobody is watching.
    this.connection = BullQueueAdapter.parseConnection(redisUrl);
    this.namespace = namespace || 'fromcode';
    this.settings = settings;
    // A failure nobody hears about is the same as no failure at all, so there is always a sink.
    this.onFailure = onFailure || ((queue, jobId, error) => {
      console.error(`[queue] job ${jobId} on "${queue}" failed: ${error?.message || error}`);
    });
  }

  private getQueue(name: string): Queue {
    if (!this.queues.has(name)) {
      const { Queue: BullMqQueue } = require('bullmq') as typeof import('bullmq');
      this.queues.set(name, new BullMqQueue(name, {
        connection: this.connection,
        prefix: `${this.namespace}:queue`
      }));
    }
    return this.queues.get(name)!;
  }

  private static parseConnection(redisUrl: string): ConnectionOptions {
    const value = String(redisUrl ?? '').trim();
    if (value === '') {
      throw new Error('A Redis URL is required for the bull queue adapter');
    }
    const url = new URL(value);
    return {
      host: url.hostname,
      port: parseInt(url.port, 10) || 6379,
      username: url.username || undefined,
      password: url.password || undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    };
  }

  /**
   * The operator's stored settings, applied once the database is readable. Queues are built lazily, so
   * anything created after this call carries them; the declared defaults hold until then.
   */
  applySettings(settings: QueueSettings): void {
    this.settings = settings;
  }

  async addJob(queueName: string, name: string, data: any, options: any = {}): Promise<any> {
    // The operator's policy first, the caller's intent on top: a job that genuinely must run once can
    // still pass `attempts: 1`, but nothing gets the old silent single-attempt behaviour by accident.
    return this.getQueue(queueName).add(name, data, { ...this.settings.jobOptions(), ...options });
  }

  registerWorker(queueName: string, processor: (job: Job) => Promise<any>, options: any = {}): void {
    if (this.workers.has(queueName)) {
      throw new Error(`A worker is already registered for queue "${queueName}"`);
    }

    const { Worker: BullMqWorker } = require('bullmq') as typeof import('bullmq');
    const worker = new BullMqWorker(queueName, processor, {
      connection: this.connection,
      prefix: `${this.namespace}:queue`,
      concurrency: options.concurrency || this.settings.concurrency
    });
    // `failed` fires once per ATTEMPT (a job with 3 attempts reports three times, verified against a real
    // Redis in bull-queue-adapter.test.ts), and `error` is the worker itself losing its connection.
    // Neither was listened for, so both used to pass in silence.
    worker.on('failed', (job, error) => this.onFailure(queueName, String(job?.id ?? 'unknown'), error as Error));
    worker.on('error', (error) => this.onFailure(queueName, 'worker', error as Error));
    this.workers.set(queueName, worker);
  }

  async close(): Promise<void> {
    await Promise.all([
      ...Array.from(this.workers.values()).map(worker => worker.close()),
      ...Array.from(this.queues.values()).map(queue => queue.close())
    ]);
  }
}
