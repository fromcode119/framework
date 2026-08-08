import { ScheduleType } from '@scheduler/enums/schedule-type.enum';

// This package OWNS the enum; core re-exports it to plugins through the SDK.
export { ScheduleType } from '@scheduler/enums/schedule-type.enum';
import { IDatabaseManager } from '@fromcode119/database';
import cron, { ScheduledTask } from 'node-cron';
import type { ISchedulerTaskHandler } from '@scheduler/interfaces/scheduler-task-handler.interface';
export type { IQueueManager } from '@scheduler/interfaces/queue-manager.interface';

import type { IQueueManager } from '@scheduler/interfaces/queue-manager.interface';

import type { ISchedulerTask } from '@scheduler/interfaces/scheduler-task.interface';

import type { ISchedulerOptions } from '@scheduler/interfaces/scheduler-options.interface';
/** Inline scheduler table name — avoids importing from @fromcode119/sdk (circular tsconfig dep). */

/** Minimal inline logger — avoids importing Logger from @fromcode119/sdk. */

export class SchedulerService {
  private static readonly logger = {
  debug: (msg: string) => console.debug('[scheduler]', msg),
  info:  (msg: string) => console.info('[scheduler]', msg),
  warn:  (msg: string) => console.warn('[scheduler]', msg),
  error: (msg: string) => console.error('[scheduler]', msg),
};

  private static readonly SCHEDULER_TASKS_TABLE = '_system_scheduler_tasks';

  private db: IDatabaseManager;
  private queueManager?: IQueueManager;
  private pulseInterval: NodeJS.Timeout | null = null;
  private handlers: Map<string, ISchedulerTaskHandler> = new Map();
  private cronJobs: Map<string, ScheduledTask> = new Map();

  constructor(db: IDatabaseManager, options: ISchedulerOptions = {}) {
    this.db = db;
    this.queueManager = options.queueManager;
  }

  /**
   * Register a task handler.
   * This is called by plugins during their initialization.
   */
  registerHandler(name: string, handler: ISchedulerTaskHandler) {
    this.handlers.set(name, handler);
    SchedulerService.logger.debug(`Registered scheduler handler: ${name}`);
  }

  /**
   * High-level registration: registers both the handler and the schedule.
   */
  async register(name: string, schedule: string, handler: ISchedulerTaskHandler, options: { type?: ScheduleType, plugin_slug?: string } = {}) {
    this.registerHandler(name, handler);
    await this.scheduleTask({
      name,
      schedule,
      type: options.type ? ScheduleType.resolve(options.type) : (schedule.includes(' ') || schedule.startsWith('@') ? ScheduleType.CRON : ScheduleType.INTERVAL),
      plugin_slug: options.plugin_slug
    });
  }

  /**
   * Register or update a task schedule in the database
   */
  async scheduleTask(task: Omit<ISchedulerTask, 'handler' | 'is_active'> & { is_active?: boolean }) {
    const existing = await this.db.find(SchedulerService.SCHEDULER_TASKS_TABLE, {
      where: { name: task.name },
      limit: 1
    });

    const is_active = task.is_active ?? true;
    const data = {
      name: task.name,
      plugin_slug: task.plugin_slug,
      schedule: task.schedule,
      // Normalised to a member so a caller-supplied string is validated once, here. The dialect
      // stores it by VALUE (see NamingStrategy.normalizeParamValue).
      type: ScheduleType.resolve(task.type),
      is_active,
      updated_at: new Date()
    };

    if (existing.length > 0) {
      await this.db.update(SchedulerService.SCHEDULER_TASKS_TABLE, { name: task.name }, data);
      SchedulerService.logger.debug(`Updated scheduler task schedule: ${task.name}`);
    } else {
      await this.db.insert(SchedulerService.SCHEDULER_TASKS_TABLE, {
        ...data,
        created_at: new Date(),
        next_run: ScheduleType.resolve(task.type) === ScheduleType.INTERVAL ? this.calculateNextRun(task.schedule) : null
      });
      SchedulerService.logger.debug(`Scheduled new task: ${task.name}`);
    }

    // Refresh the in-memory cron job if applicable
    if (ScheduleType.resolve(task.type) === ScheduleType.CRON) {
      if (is_active) {
        this.setupCronJob(task.name, task.schedule);
      } else {
        if (this.cronJobs.has(task.name)) {
          this.cronJobs.get(task.name)?.stop();
          this.cronJobs.delete(task.name);
        }
      }
    }
  }

  /**
   * Start the scheduler
   */
  async start(pulseIntervalMs: number = 60000) { // Default 1 minute pulse
    SchedulerService.logger.info(`Scheduler service starting...`);
    
    // 1. Initialize cron jobs from DB
    await this.syncFromDatabase();

    // 2. Start pulse for interval-based tasks.
    // The catch is load-bearing, not defensive: a timer callback has no caller to reject to, so a
    // single failed `db.find` inside pulse() became an unobserved rejection — fatal under Node 22 —
    // once a minute, forever. A pulse that fails must be logged and retried on the next tick.
    this.pulseInterval = setInterval(() => {
      this.pulse().catch((error: unknown) => {
        SchedulerService.logger.error(
          `Scheduler pulse failed; retrying on the next tick: ${error instanceof Error ? error.message : String(error)}`
        );
      });
    }, pulseIntervalMs);

    SchedulerService.logger.info(`Scheduler service started (Pulse interval: ${pulseIntervalMs}ms)`);
  }

  /**
   * Stop the scheduler
   */
  async stop() {
    if (this.pulseInterval) {
      clearInterval(this.pulseInterval);
      this.pulseInterval = null;
    }
    for (const job of this.cronJobs.values()) {
      job.stop();
    }
    this.cronJobs.clear();
    SchedulerService.logger.info(`Scheduler service stopped.`);
  }

  /**
   * Run a registered handler by name.
   * Useful for queue workers.
   */
  async runHandler(name: string, data?: any) {
    const handler = this.handlers.get(name);
    if (!handler) {
      SchedulerService.logger.warn(`No handler registered for task "${name}". Skipping.`);
      return;
    }
    await handler(data);
  }

  /**
   * Sync active cron tasks from database to memory
   */
  private async syncFromDatabase() {
    const activeTasks = await this.db.find(SchedulerService.SCHEDULER_TASKS_TABLE, {
      where: { is_active: true }
    });

    for (const task of activeTasks) {
      if (ScheduleType.resolve(task.type) === ScheduleType.CRON) {
        this.setupCronJob(task.name, task.schedule);
      }
    }
  }

  /**
   * Setup/Restart a node-cron job
   */
  private setupCronJob(name: string, schedule: string) {
    if (this.cronJobs.has(name)) {
      this.cronJobs.get(name)?.stop();
    }

    if (!cron.validate(schedule)) {
      SchedulerService.logger.error(`Invalid cron expression for task "${name}": ${schedule}`);
      return;
    }

    // Same reasoning as the pulse timer: a cron callback has no caller. runTask() catches today, but
    // nothing structural keeps it that way, and the cost of it changing is a dead process.
    const job = cron.schedule(schedule, () => {
      this.runTask(name).catch((error: unknown) => {
        SchedulerService.logger.error(
          `Cron task "${name}" rejected: ${error instanceof Error ? error.message : String(error)}`
        );
      });
    });

    this.cronJobs.set(name, job);
    SchedulerService.logger.debug(`Set up cron job for "${name}": ${schedule}`);
  }

  /**
   * Pulse checks for interval-based tasks that are due
   */
  private async pulse() {
    const now = new Date();
    const tasks = await this.db.find(SchedulerService.SCHEDULER_TASKS_TABLE, {
      where: { type: ScheduleType.INTERVAL, is_active: true }
    });

    for (const task of tasks) {
      // Logic for interval: "5m", "1h", etc.
      // For simplicity in this pulse, we check if now > next_run
      if (task.next_run && now >= new Date(task.next_run)) {
        await this.runTask(task.name);
        
        // Calculate next run
        const nextRun = this.calculateNextRun(task.schedule);
        await this.db.update(SchedulerService.SCHEDULER_TASKS_TABLE, { name: task.name }, {
          last_run: now,
          next_run: nextRun
        });
      } else if (!task.next_run) {
        // First run initialization
        const nextRun = this.calculateNextRun(task.schedule);
        await this.db.update(SchedulerService.SCHEDULER_TASKS_TABLE, { name: task.name }, { next_run: nextRun });
      }
    }
  }

  /**
   * Execute a task (either directly or via queue)
   */
  private async runTask(name: string) {
    const handler = this.handlers.get(name);
    if (!handler) {
      SchedulerService.logger.warn(`No handler registered for task "${name}". Skipping.`);
      return;
    }

    SchedulerService.logger.info(`Running task: ${name}`);
    
    try {
      if (this.queueManager) {
        // Offload to background queue
        await this.queueManager.addJob('scheduler', name, { taskName: name });
        SchedulerService.logger.debug(`Dispatched task "${name}" to queue.`);
      } else {
        // Run immediately
        await handler();
      }

      // Update last run in DB
      await this.db.update(SchedulerService.SCHEDULER_TASKS_TABLE, { name }, {
        last_run: new Date()
      });

    } catch (error: any) {
      SchedulerService.logger.error(`Failed to run task "${name}": ${error.message}`);
    }
  }

  private calculateNextRun(schedule: string): Date {
    const now = new Date();
    const match = schedule.match(/^([\d.]+)([smhdw])$/);
    if (!match) return new Date(now.getTime() + 5 * 60000); // Default 5m if invalid

    const amount = parseFloat(match[1]);
    const unit = match[2];
    const msMap: Record<string, number> = {
      s: 1000,
      m: 60000,
      h: 3600000,
      d: 86400000,
      w: 604800000
    };

    return new Date(now.getTime() + amount * (msMap[unit] || 60000));
  }
}