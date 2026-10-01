import { AsyncLocalStorage } from 'async_hooks';

/**
 * How many api worker processes serve this deployment, and what that means for a per-process budget.
 *
 * `API_WORKERS` is the deploy setting (one per core by default once the api runs as several workers;
 * 1 when unset, which is how every deployment runs today). Every worker reads the same value.
 *
 * A limit counted in each process's memory would be multiplied by the number of workers. For counters
 * too hot for a network round trip — every plugin database call is counted — each worker enforces its
 * SHARE of the operator's limit instead: the workers split requests evenly, so the total stays close
 * to the setting without any shared state.
 */
export class ApiWorkers {
  static count(): number {
    const workers = Number.parseInt(String(process.env.API_WORKERS ?? ''), 10);
    return Number.isFinite(workers) && workers > 1 ? workers : 1;
  }

  static isMultiProcess(): boolean {
    return ApiWorkers.count() > 1;
  }

  /**
   * This worker's number, 0-based (`API_WORKER_INDEX`, set by the process that starts the workers).
   * A single api process is worker 0.
   */
  static index(): number {
    const index = Number.parseInt(String(process.env.API_WORKER_INDEX ?? ''), 10);
    return Number.isFinite(index) && index > 0 ? index : 0;
  }

  /**
   * Whether this api process starts plugin processes on its own — at boot, after a crash, on a move to a
   * newer extension-host. With several, only process 0 does; the others attach to what it started
   * (PluginHostSharedProcesses). An operator's update starts the new process wherever it was asked.
   */
  static startsPluginProcesses(): boolean {
    return !ApiWorkers.isMultiProcess() || ApiWorkers.isFirstWorker() || ApiWorkers.operator.getStore() === true;
  }

  /**
   * Runs an operator's plugin change (install, enable, update…) in THIS api process: whatever plugin
   * process it needs, it starts here, as a single api would. The other api processes then load the change
   * (PluginsChangedSignal) and attach to what it started.
   */
  static asOperator<T>(work: () => Promise<T>): Promise<T> {
    return ApiWorkers.operator.run(true, work);
  }

  private static readonly operator = new AsyncLocalStorage<boolean>();

  /** Whether this worker runs the deployment's once-only background work (monitors, retention, downloads). */
  static isFirstWorker(): boolean {
    return ApiWorkers.index() === 0;
  }

  /** This worker's part of `limit`; 0 and below (unlimited / off) pass through unchanged. */
  static share(limit: number): number {
    if (!(limit > 0)) return limit;
    return Math.max(1, Math.ceil(limit / ApiWorkers.count()));
  }
}
