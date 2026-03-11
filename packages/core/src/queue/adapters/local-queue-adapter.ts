import { QueueAdapter } from '../types';

/**
 * Local adapter: Executes jobs immediately/asynchronously via setTimeout (for dev/test)
 */
export class LocalQueueAdapter implements QueueAdapter {
  private workers: Map<string, (job: any) => Promise<any>> = new Map();

  async addJob(queueName: string, name: string, data: any): Promise<any> {
    const jobId = 'local-' + Math.random().toString(36).substring(2, 9);
    
    // Immediate execution if worker exists
    const worker = this.workers.get(queueName);
    if (worker) {
      // Run on next tick to simulate async behavior
      setTimeout(async () => {
        try {
          await worker({ id: jobId, name, data, queueName });
        } catch (e: any) {
          console.error(`[LocalQueue] Job ${name} (${jobId}) failed: ${e.message}`);
        }
      }, 0);
    } else {
      console.log(`[LocalQueue] Job ${name} (${jobId}) added to ${queueName} (No worker registered yet)`);
    }
    
    return { id: jobId };
  }

  registerWorker(queueName: string, processor: (job: any) => Promise<any>): void {
    this.workers.set(queueName, processor);
  }

  async close(): Promise<void> {
    this.workers.clear();
  }
}