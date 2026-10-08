/** One job as the queue holds it now, for an operator to see. */
export interface IQueueJobSnapshot {
  queue: string;
  id: string;
  name: string;
  /** A `QueueJobState` value. */
  state: string;
  createdAt: string | null;
  /** When a delayed job is due; null for one that runs as soon as a worker is free. */
  runAt: string | null;
  attemptsMade: number;
  attempts: number;
  failedReason: string | null;
}
