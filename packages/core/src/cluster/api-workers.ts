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

  /** This worker's part of `limit`; 0 and below (unlimited / off) pass through unchanged. */
  static share(limit: number): number {
    if (!(limit > 0)) return limit;
    return Math.max(1, Math.ceil(limit / ApiWorkers.count()));
  }
}
