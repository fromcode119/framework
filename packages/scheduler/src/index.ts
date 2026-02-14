import { IDatabaseManager, sql } from '@fromcode/database';
import { Logger } from '@fromcode/sdk';
import cron, { ScheduledTask } from 'node-cron';

const logger = new Logger({ namespace: 'scheduler' });

export type SchedulerTaskHandler = (data?: any) => Promise<void>;

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

export class SchedulerService {
  private db: IDatabaseManager;
  private queueManager?: IQueueManager;
  private pulseInterval: NodeJS.Timeout | null = null;
  private handlers: Map<string, SchedulerTaskHandler> = new Map();
  private cronJobs: Map<string, ScheduledTask> = new Map();

  constructor(db: IDatabaseManager, options: SchedulerOptions = {}) {
    this.db = db;
    this.queueManager = options.queueManager;
  }

  /**
   * Register a task handler.
   * This is called by plugins during their initialization.
   */
  registerHandler(name: string, handler: SchedulerTaskHandler) {
    this.handlers.set(name, handler);
    logger.debug(`Registered scheduler handler: ${name}`);
  }

  /**
   * High-level registration: registers both the handler and the schedule.
   */
  async register(name: string, schedule: string, handler: SchedulerTaskHandler, options: { type?: 'cron' | 'interval', plugin_slug?: string } = {}) {
    this.registerHandler(name, handler);
    await this.scheduleTask({
      name,
      schedule,
      type: options.type || (schedule.includes(' ') || schedule.startsWith('@') ? 'cron' : 'interval'),
      plugin_slug: options.plugin_slug
    });
  }

  /**
   * Register or update a task schedule in the database
   */
  async scheduleTask(task: Omit<SchedulerTask, 'handler' | 'is_active'> & { is_active?: boolean }) {
    const existing = await this.db.find('_system_scheduler_tasks', {
      where: { name: task.name },
      limit: 1
    });

    const is_active = task.is_active ?? true;
    const data = {
      name: task.name,
      plugin_slug: task.plugin_slug,
      schedule: task.schedule,
      type: task.type,
      is_active,
      updated_at: new Date()
    };

    if (existing.length > 0) {
      await this.db.update('_system_scheduler_tasks', data, { name: task.name });
      logger.debug(`Updated scheduler task schedule: ${task.name}`);
    } else {
      await this.db.insert('_system_scheduler_tasks', {
        ...data,
        created_at: new Date(),
        next_run: task.type === 'interval' ? this.calculateNextRun(task.schedule) : null
      });
      logger.debug(`Scheduled new task: ${task.name}`);
    }

    // Refresh the in-memory cron job if applicable
    if (task.type === 'cron') {
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
    logger.info(`Scheduler service starting...`);
    
    // 1. Initialize cron jobs from DB
    await this.syncFromDatabase();

    // 2. Start pulse for interval-based tasks
    this.pulseInterval = setInterval(() => {
      this.pulse();
    }, pulseIntervalMs);

    logger.info(`Scheduler service started (Pulse interval: ${pulseIntervalMs}ms)`);
  }

  /**
   * Run a registered handler by name.
   * Useful for queue workers.
   */
  async runHandler(name: string, data?: any) {
    const handler = this.handlers.get(name);
    if (!handler) {
      logger.warn(`No handler registered for task "${name}". Skipping.`);
      return;
    }
    await handler(data);
  }

  /**
   * Sync active cron tasks from database to memory
   */
  private async syncFromDatabase() {
    const activeTasks = await this.db.find('_system_scheduler_tasks', {
      where: { is_active: true }
    });

    for (const task of activeTasks) {
      if (task.type === 'cron') {
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
      logger.error(`Invalid cron expression for task "${name}": ${schedule}`);
      return;
    }

    const job = cron.schedule(schedule, () => {
      this.runTask(name);
    });

    this.cronJobs.set(name, job);
    logger.debug(`Set up cron job for "${name}": ${schedule}`);
  }

  /**
   * Pulse checks for interval-based tasks that are due
   */
  private async pulse() {
    const now = new Date();
    const tasks = await this.db.find('_system_scheduler_tasks', {
      where: { type: 'interval', is_active: true }
    });

    for (const task of tasks) {
      // Logic for interval: "5m", "1h", etc.
      // For simplicity in this pulse, we check if now > next_run
      if (task.next_run && now >= new Date(task.next_run)) {
        await this.runTask(task.name);
        
        // Calculate next run
        const nextRun = this.calculateNextRun(task.schedule);
        await this.db.update('_system_scheduler_tasks', {
          last_run: now,
          next_run: nextRun
        }, { name: task.name });
      } else if (!task.next_run) {
        // First run initialization
        const nextRun = this.calculateNextRun(task.schedule);
        await this.db.update('_system_scheduler_tasks', { next_run: nextRun }, { name: task.name });
      }
    }
  }

  /**
   * Execute a task (either directly or via queue)
   */
  private async runTask(name: string) {
    const handler = this.handlers.get(name);
    if (!handler) {
      logger.warn(`No handler registered for task "${name}". Skipping.`);
      return;
    }

    logger.info(`Running task: ${name}`);
    
    try {
      if (this.queueManager) {
        // Offload to background queue
        await this.queueManager.addJob('scheduler', name, { taskName: name });
        logger.debug(`Dispatched task "${name}" to queue.`);
      } else {
        // Run immediately
        await handler();
      }

      // Update last run in DB
      await this.db.update('_system_scheduler_tasks', {
        last_run: new Date()
      }, { name });

    } catch (error: any) {
      logger.error(`Failed to run task "${name}": ${error.message}`);
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

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.pulseInterval) {
      clearInterval(this.pulseInterval);
      this.pulseInterval = null;
    }

    for (const job of this.cronJobs.values()) {
      job.stop();
    }
    this.cronJobs.clear();
    
    logger.info('Scheduler service stopped');
  }
}
