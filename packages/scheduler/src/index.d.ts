import { IDatabaseManager } from '@fromcode/database';
export type SchedulerTaskHandler = (data?: any) => Promise<void>;
export interface IQueueManager {
    addJob(queue: string, name: string, data: any, options?: any): Promise<any>;
}
export interface SchedulerTask {
    name: string;
    schedule: string;
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
export declare class SchedulerService {
    private db;
    private queueManager?;
    private pulseInterval;
    private handlers;
    private cronJobs;
    constructor(db: IDatabaseManager, options?: SchedulerOptions);
    /**
     * Register a task handler.
     * This is called by plugins during their initialization.
     */
    registerHandler(name: string, handler: SchedulerTaskHandler): void;
    /**
     * High-level registration: registers both the handler and the schedule.
     */
    register(name: string, schedule: string, handler: SchedulerTaskHandler, options?: {
        type?: 'cron' | 'interval';
        plugin_slug?: string;
    }): Promise<void>;
    /**
     * Register or update a task schedule in the database
     */
    scheduleTask(task: Omit<SchedulerTask, 'handler' | 'is_active'> & {
        is_active?: boolean;
    }): Promise<void>;
    /**
     * Start the scheduler
     */
    start(pulseIntervalMs?: number): Promise<void>;
    /**
     * Run a registered handler by name.
     * Useful for queue workers.
     */
    runHandler(name: string, data?: any): Promise<void>;
    /**
     * Sync active cron tasks from database to memory
     */
    private syncFromDatabase;
    /**
     * Setup/Restart a node-cron job
     */
    private setupCronJob;
    /**
     * Pulse checks for interval-based tasks that are due
     */
    private pulse;
    /**
     * Execute a task (either directly or via queue)
     */
    private runTask;
    private calculateNextRun;
    /**
     * Stop the scheduler
     */
    stop(): void;
}
