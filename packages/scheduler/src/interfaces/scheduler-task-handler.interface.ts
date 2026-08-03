/** A scheduled task handler. */
export interface ISchedulerTaskHandler {
  (data?: any): Promise<void>;
}
