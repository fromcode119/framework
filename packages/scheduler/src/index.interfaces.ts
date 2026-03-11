import type { SchedulerTaskHandler } from './index.types';

export interface IQueueManager {
  addJob(queue: string, name: string, data: any, options?: any): Promise<any>;
}

export interface SchedulerTask {
  name: string;
  schedule: string; // Cron syntax or interval string (e.g. "5m")
  type: 'cron' | 'interval';
  plugin_slug?: string;
  handler: SchedulerTaskHandler;
  is_active: boolean;
  last_run?: Date;
  next_run?: Date;
}

export interface SchedulerOptions {
  queueManager?: IQueueManager;
  pulseIntervalMs?: number;
}
