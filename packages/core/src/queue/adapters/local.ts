import { QueueAdapter } from '../types';

/**
 * Local adapter: Executes jobs immediately/synchronously (for dev/test)
 */
export class LocalQueueAdapter implements QueueAdapter {
  async addJob(queueName: string, name: string, data: any): Promise<any> {
    // In local mode, we don't have a background worker, so we just log or execute if a worker is registered
    // For now, simple mock:
    console.log(`[LocalQueue] Job ${name} added to ${queueName}`);
    return { id: 'local-' + Math.random() };
  }

  registerWorker(): void {
    // No-op for local sync mode in this simple implementation
  }

  async close(): Promise<void> {}
}
