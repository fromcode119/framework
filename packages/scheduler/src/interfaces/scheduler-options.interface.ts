import type { IQueueManager } from '@scheduler/interfaces/queue-manager.interface';

export interface ISchedulerOptions {
  queueManager?: IQueueManager;
  pulseIntervalMs?: number;
}
