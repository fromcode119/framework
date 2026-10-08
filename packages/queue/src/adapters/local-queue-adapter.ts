import { IQueueAdapter } from '@queue/interfaces/queue-adapter.interface';
import type { IQueueJobSnapshot } from '@queue/interfaces/queue-job-snapshot.interface';
import { QueueJobState } from '@queue/enums/queue-job-state.enum';

/**
 * Local adapter: runs jobs in this process (for dev/test, or a deployment with no Redis).
 *
 * It keeps every job it has not finished, so the queue can be SEEN: a job waits for its time when one
 * was asked for (`delay`), and waits for its worker when none is registered yet — it used to run every
 * job at once whatever its delay, and to drop a job added before its worker with only a log line.
 */
export class LocalQueueAdapter implements IQueueAdapter {
  /** Failed jobs kept to be seen, newest last; older ones are let go. */
  private static readonly FAILED_KEPT = 100;
  private workers: Map<string, (job: any) => Promise<any>> = new Map();
  private jobs: Map<string, { queue: string; id: string; name: string; data: any; state: QueueJobState; createdAt: number; runAt: number | null; attemptsMade: number; failedReason: string | null; timer: ReturnType<typeof setTimeout> | null }> = new Map();

  /** Nothing to apply: there is no broker to carry attempts, backoff or retention. */
  applySettings(): void {}

  async addJob(queueName: string, name: string, data: any, options: any = {}): Promise<any> {
    const id = 'local-' + Math.random().toString(36).substring(2, 9);
    const delay = Number(options?.delay) > 0 ? Number(options.delay) : 0;
    const now = Date.now();
    this.jobs.set(id, { queue: queueName, id, name, data, state: delay ? QueueJobState.DELAYED : QueueJobState.WAITING, createdAt: now, runAt: delay ? now + delay : null, attemptsMade: 0, failedReason: null, timer: null });
    this.schedule(id);
    return { id };
  }

  registerWorker(queueName: string, processor: (job: any) => Promise<any>): void {
    this.workers.set(queueName, processor);
    for (const job of this.jobs.values()) {
      if (job.queue === queueName && job.state === QueueJobState.WAITING) this.schedule(job.id);
    }
  }

  async listJobs(limit: number): Promise<IQueueJobSnapshot[]> {
    const byState = new Map<QueueJobState, IQueueJobSnapshot[]>();
    for (const job of Array.from(this.jobs.values()).reverse()) {
      const list = byState.get(job.state) ?? [];
      if (list.length >= limit) continue;
      list.push({
        queue: job.queue,
        id: job.id,
        name: job.name,
        state: job.state.value,
        createdAt: new Date(job.createdAt).toISOString(),
        runAt: job.runAt === null ? null : new Date(job.runAt).toISOString(),
        attemptsMade: job.attemptsMade,
        attempts: 1,
        failedReason: job.failedReason,
      });
      byState.set(job.state, list);
    }
    return Array.from(byState.values()).flat();
  }

  async close(): Promise<void> {
    for (const job of this.jobs.values()) if (job.timer) clearTimeout(job.timer);
    this.jobs.clear();
    this.workers.clear();
  }

  /** Runs the job when its time comes and its worker exists; until then it stays listed. */
  private schedule(id: string): void {
    const job = this.jobs.get(id);
    if (!job || job.timer || !this.workers.has(job.queue)) return;
    job.timer = setTimeout(() => void this.run(id), Math.max(0, (job.runAt ?? 0) - Date.now()));
  }

  private async run(id: string): Promise<void> {
    const job = this.jobs.get(id);
    const worker = job ? this.workers.get(job.queue) : undefined;
    if (!job || !worker) return;
    job.timer = null;
    job.state = QueueJobState.ACTIVE;
    job.attemptsMade += 1;
    try {
      await worker({ id: job.id, name: job.name, data: job.data, queueName: job.queue });
      this.jobs.delete(id);
    } catch (e: any) {
      console.error(`[LocalQueue] Job ${job.name} (${job.id}) failed: ${e?.message ?? e}`);
      job.state = QueueJobState.FAILED;
      job.failedReason = String(e?.message ?? e);
      this.forgetOldFailures();
    }
  }

  private forgetOldFailures(): void {
    const failed = Array.from(this.jobs.values()).filter((job) => job.state === QueueJobState.FAILED);
    for (const job of failed.slice(0, Math.max(0, failed.length - LocalQueueAdapter.FAILED_KEPT))) this.jobs.delete(job.id);
  }
}
