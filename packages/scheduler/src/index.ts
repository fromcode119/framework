import { ScheduleType } from '@scheduler/enums/schedule-type.enum';
import { IDatabaseManager } from '@fromcode119/database';
import type { ISchedulerTaskHandler } from '@scheduler/interfaces/scheduler-task-handler.interface';
import type { IQueueManager } from '@scheduler/interfaces/queue-manager.interface';
import type { ISchedulerTask } from '@scheduler/interfaces/scheduler-task.interface';
import type { ISchedulerOptions } from '@scheduler/interfaces/scheduler-options.interface';
import { SchedulerRunClaim } from '@scheduler/scheduler-run-claim';
import { SchedulerRunJournal } from '@scheduler/scheduler-run-journal';
import { SchedulerInterval } from '@scheduler/scheduler-interval';
import { SchedulerCronTimers } from '@scheduler/scheduler-cron-timers';

// This package OWNS the enum; core re-exports it to plugins through the SDK.
export { ScheduleType } from '@scheduler/enums/schedule-type.enum';
export type { IQueueManager } from '@scheduler/interfaces/queue-manager.interface';
export { SchedulerRunJournal } from '@scheduler/scheduler-run-journal';
export { SchedulerRunStatus } from '@scheduler/enums/scheduler-run-status.enum';

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
  private readonly cron: SchedulerCronTimers;
  private readonly claims: SchedulerRunClaim;
  private readonly journal: SchedulerRunJournal;
  /** Which plugin registered each task, for its run rows; a framework task has none. */
  private owners: Map<string, string | null> = new Map();

  constructor(db: IDatabaseManager, options: ISchedulerOptions = {}) {
    this.db = db;
    this.queueManager = options.queueManager;
    this.claims = new SchedulerRunClaim(db, SchedulerService.SCHEDULER_TASKS_TABLE);
    this.journal = new SchedulerRunJournal(db);
    this.cron = new SchedulerCronTimers((name, slotMs) => this.runClaimedCron(name, slotMs), SchedulerService.logger);
  }

  /**
   * Hands the scheduler the queue once it exists.
   *
   * Which queue driver runs is the operator's choice, resolved asynchronously from the `queue`
   * integration, so it is not available when this service is constructed. Until it arrives the
   * scheduler runs task handlers inline, which is the same behaviour as having no queue configured.
   */
  useQueue(queueManager: IQueueManager): void {
    this.queueManager = queueManager;
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
    this.owners.set(name, options.plugin_slug || null);
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
      if (is_active) this.setupCronJob(task.name, task.schedule);
      else this.cron.stop(task.name);
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
    this.cron.stopAll();
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
    await this.execute(name, handler, data);
  }

  /** One run of a task, recorded: the queue worker and the inline runner both come through here. */
  private execute(name: string, handler: ISchedulerTaskHandler, data?: any): Promise<unknown> {
    return this.journal.record({ taskName: name, pluginSlug: this.owners.get(name) ?? null }, async () => handler(data));
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

  /** Setup/Restart a node-cron job, and record when it fires next. */
  private setupCronJob(name: string, schedule: string) {
    if (this.cron.set(name, schedule)) void this.recordNextRun(name);
  }

  /**
   * A cron task's next firing, as its timer will actually fire it. Only interval tasks used to carry a
   * `next_run`, so every cron task read "not scheduled yet" on the dashboard while running each minute.
   */
  private async recordNextRun(name: string): Promise<void> {
    const nextRun = this.cron.nextRun(name);
    if (!nextRun) return;
    try {
      await this.db.update(SchedulerService.SCHEDULER_TASKS_TABLE, { name }, { next_run: nextRun });
    } catch (error: unknown) {
      SchedulerService.logger.warn(`Could not record the next run of "${name}": ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** Runs a cron firing only if this instance claimed it (see SchedulerRunClaim). */
  private async runClaimedCron(name: string, slotMs: number): Promise<void> {
    if (!(await this.claims.claimCron(name, new Date(), slotMs))) {
      SchedulerService.logger.debug(`Task "${name}" was claimed by another instance for this slot; skipping.`);
      return;
    }
    await this.recordNextRun(name);
    await this.runTask(name);
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
        // Claimed BEFORE it runs, by moving next_run forward from the value read: another instance's
        // pulse that read the same row matches nothing and leaves this run to whoever claimed it.
        const nextRun = this.calculateNextRun(task.schedule);
        if (!(await this.claims.claimInterval(task.name, task.next_run, nextRun))) continue;
        await this.runTask(task.name);
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
        await this.execute(name, handler);
      }

    } catch (error: any) {
      SchedulerService.logger.error(`Failed to run task "${name}": ${error.message}`);
    }
  }

  private calculateNextRun(schedule: string): Date {
    return SchedulerInterval.nextRun(schedule, new Date());
  }
}
