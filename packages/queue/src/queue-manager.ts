import { IQueueAdapter } from '@queue/interfaces/queue-adapter.interface';
import type { QueueSettings } from '@queue/queue-settings';

/**
 * The queue, as the rest of the framework sees it.
 *
 * It is handed an adapter rather than choosing one: which driver runs is the OPERATOR's decision,
 * declared as the `queue` integration and resolved from what they saved. A factory here used to pick
 * the driver from an environment variable, which meant the running configuration appeared in no admin
 * screen and could not be changed without a redeploy.
 */
export class QueueManager {
  constructor(private readonly adapter: IQueueAdapter) {}

  /** Hands the operator's job policy to the adapter; the in-memory one has nothing to set. */
  applySettings(settings: QueueSettings): void {
    this.adapter.applySettings(settings);
  }

  async addJob(queueName: string, name: string, data: any, options: any = {}) {
    return this.adapter.addJob(queueName, name, data, options);
  }

  registerWorker(queueName: string, processor: (job: any) => Promise<any>, options: any = {}) {
    return this.adapter.registerWorker(queueName, processor, options);
  }

  async close() {
    await this.adapter.close();
  }
}
