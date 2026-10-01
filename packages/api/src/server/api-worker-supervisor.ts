import cluster from 'cluster';
import type { Worker } from 'cluster';
import { ApiWorkers } from '@fromcode119/core';
import { ExtensionHostSocket } from '@fromcode119/core/process';

/**
 * Runs the api as several processes behind one port when `API_WORKERS` asks for more than one.
 *
 * This process serves nothing itself. It starts the api processes ONE AT A TIME, each only once the one
 * before it answers: process 0 starts the plugin processes, and every later one attaches to those
 * instead of starting its own (`ApiWorkers.mayStartPluginProcesses`). It replaces a process that dies,
 * and restarts processes one at a time when one asks to be (`requestRestart` — the platform's plugins
 * changed in another process), so the others keep serving throughout.
 *
 * Several api processes can share plugin processes only through the extension-host; without one, each
 * would start its own set of every plugin. Then this says so and the api runs as one process.
 */
export class ApiWorkerSupervisor {
  static readonly READY = 'fc-api-worker:ready';
  static readonly RESTART_ME = 'fc-api-worker:restart-me';
  private static readonly START_TIMEOUT_MS = 300_000;
  private static readonly STOP_TIMEOUT_MS = 40_000;
  private static readonly BACKOFF_MS = [1_000, 2_000, 5_000, 10_000, 30_000];
  private static readonly HEALTHY_AFTER_MS = 60_000;

  private readonly workers = new Map<number, Worker>();
  private readonly crashes = new Map<number, number>();
  private readonly restartQueue: number[] = [];
  private restarting = false;
  private stopping = false;

  constructor(private readonly log: (line: string) => void = (line) => console.info(`[api-workers] ${line}`)) {}

  /** In the process the container started, with more than one api process asked for. */
  static isWanted(): boolean {
    return cluster.isPrimary && ApiWorkers.count() > 1;
  }

  /** Why several api processes cannot run here, or null when they can. */
  static unsupportedReason(): string | null {
    if (String(process.env[ExtensionHostSocket.ENV] ?? '').trim()) return null;
    return `API_WORKERS=${ApiWorkers.count()} needs the extension-host (${ExtensionHostSocket.ENV}): only there can api processes share one set of plugin processes`;
  }

  /** In an api process the supervisor started: it is serving. */
  static reportReady(): void {
    if (cluster.isWorker && process.send) process.send({ type: ApiWorkerSupervisor.READY });
  }

  /** In an api process the supervisor started: replace this process when it is its turn. False when unsupervised. */
  static requestRestart(): boolean {
    if (!cluster.isWorker || !process.send) return false;
    process.send({ type: ApiWorkerSupervisor.RESTART_ME });
    return true;
  }

  async run(): Promise<void> {
    const count = ApiWorkers.count();
    this.log(`starting ${count} api processes, one at a time`);
    process.once('SIGTERM', () => void this.stop('SIGTERM'));
    process.once('SIGINT', () => void this.stop('SIGINT'));
    for (let index = 0; index < count && !this.stopping; index += 1) await this.startUntilReady(index);
    if (!this.stopping) this.log(`all ${count} api processes are serving`);
  }

  /** Starts api process `index`, retrying with a growing pause until it answers. */
  private async startUntilReady(index: number): Promise<void> {
    for (let attempt = 0; !this.stopping; attempt += 1) {
      try {
        await this.start(index);
        return;
      } catch (error) {
        const pause = ApiWorkerSupervisor.BACKOFF_MS[Math.min(attempt, ApiWorkerSupervisor.BACKOFF_MS.length - 1)];
        this.log(`api process ${index} did not start (${error instanceof Error ? error.message : String(error)}); trying again in ${pause} ms`);
        await new Promise((resolve) => setTimeout(resolve, pause));
      }
    }
  }

  private start(index: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const worker = cluster.fork({ API_WORKER_INDEX: String(index) });
      let ready = false;
      const timer = setTimeout(() => { if (!ready) { worker.process.kill('SIGKILL'); reject(new Error('no answer in time')); } }, ApiWorkerSupervisor.START_TIMEOUT_MS);
      ApiWorkerSupervisor.events(worker).on('message', (message: { type?: string }) => {
        if (message?.type === ApiWorkerSupervisor.READY && !ready) {
          ready = true;
          clearTimeout(timer);
          this.workers.set(index, worker);
          setTimeout(() => { if (this.workers.get(index) === worker) this.crashes.delete(index); }, ApiWorkerSupervisor.HEALTHY_AFTER_MS).unref();
          resolve();
        }
        if (message?.type === ApiWorkerSupervisor.RESTART_ME) this.enqueueRestart(index);
      });
      ApiWorkerSupervisor.events(worker).on('exit', (code: number | null, signal: string | null) => {
        clearTimeout(timer);
        if (!ready) { reject(new Error(`exited (${signal ?? code}) while starting`)); return; }
        if (this.workers.get(index) !== worker) return;
        this.workers.delete(index);
        if (this.stopping) return;
        void this.replaceAfterCrash(index, `${signal ?? code}`);
      });
    });
  }

  private async replaceAfterCrash(index: number, how: string): Promise<void> {
    const crashes = (this.crashes.get(index) ?? 0) + 1;
    this.crashes.set(index, crashes);
    const pause = ApiWorkerSupervisor.BACKOFF_MS[Math.min(crashes - 1, ApiWorkerSupervisor.BACKOFF_MS.length - 1)];
    this.log(`api process ${index} exited (${how}); starting it again in ${pause} ms`);
    await new Promise((resolve) => setTimeout(resolve, pause));
    if (!this.stopping && !this.workers.has(index)) await this.startUntilReady(index);
  }

  private enqueueRestart(index: number): void {
    if (this.stopping || this.restartQueue.includes(index)) return;
    this.restartQueue.push(index);
    void this.drainRestarts();
  }

  /** One at a time: the others serve while each is replaced. */
  private async drainRestarts(): Promise<void> {
    if (this.restarting) return;
    this.restarting = true;
    try {
      while (!this.stopping && this.restartQueue.length) {
        const index = this.restartQueue.shift() as number;
        const worker = this.workers.get(index);
        if (!worker) continue;
        this.log(`restarting api process ${index} to load the platform's plugins as they are now`);
        this.workers.delete(index);
        await ApiWorkerSupervisor.stopWorker(worker);
        await this.startUntilReady(index);
      }
    } finally {
      this.restarting = false;
    }
  }

  private async stop(signal: string): Promise<void> {
    if (this.stopping) return;
    this.stopping = true;
    this.log(`${signal}: stopping ${this.workers.size} api processes`);
    await Promise.all([...this.workers.values()].map((worker) => ApiWorkerSupervisor.stopWorker(worker)));
    process.exit(0);
  }

  /**
   * A worker is an EventEmitter (its `message` and `exit`), but the api's build resolves cluster's
   * `Worker` type without the emitter's methods; Node's own emitter interface states them.
   */
  private static events(worker: Worker): NodeJS.EventEmitter {
    return worker as unknown as NodeJS.EventEmitter;
  }

  /** SIGTERM lets it finish what is in flight (GracefulHttpShutdown); past the limit it is killed. */
  private static stopWorker(worker: Worker): Promise<void> {
    return new Promise<void>((resolve) => {
      if (worker.isDead()) { resolve(); return; }
      const timer = setTimeout(() => worker.process.kill('SIGKILL'), ApiWorkerSupervisor.STOP_TIMEOUT_MS);
      ApiWorkerSupervisor.events(worker).once('exit', () => { clearTimeout(timer); resolve(); });
      worker.process.kill('SIGTERM');
    });
  }
}
