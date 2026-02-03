import { DatabaseManager } from '@fromcode/database';
import { Logger } from '@fromcode/sdk';

const logger = new Logger({ namespace: 'Scheduler' });

export type SchedulerTask = () => Promise<void>;

export class SchedulerService {
  private db: DatabaseManager;
  private interval: NodeJS.Timeout | null = null;
  private tasks: Map<string, SchedulerTask> = new Map();

  constructor(db: DatabaseManager) {
    this.db = db;
  }

  /**
   * Register a task to run on every pulse
   */
  registerTask(name: string, task: SchedulerTask) {
    if (this.tasks.has(name)) {
      logger.warn(`Task "${name}" is already registered. Overwriting.`);
    }
    this.tasks.set(name, task);
    logger.debug(`Registered scheduler task: ${name}`);
  }

  /**
   * Start the scheduler to check for pending tasks
   */
  start(intervalMs: number = 5 * 60 * 1000) { // Default 5 minutes
    logger.info(`Scheduler service started (Interval: ${intervalMs}ms)`);
    
    // Run initial pulse
    this.pulse();

    this.interval = setInterval(() => {
      this.pulse();
    }, intervalMs);
  }

  /**
   * Run one pulse of all registered tasks
   */
  async pulse() {
    logger.debug(`Scheduler pulse starting (${this.tasks.size} tasks)...`);
    
    for (const [name, task] of this.tasks.entries()) {
      try {
        await task();
      } catch (error: any) {
        logger.error(`Error in scheduler task "${name}": ${error.message}`);
      }
    }
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('Scheduler service stopped');
    }
  }
}
