import { ApiWorkers } from '@core/cluster/api-workers';


export class RateLimiter {
  private counts: Map<string, { count: number, resetAt: number }> = new Map();

  constructor(
    private limit: number = 1000, 
    private windowMs: number = 60000
  ) {}

  /**
   * `limit` overrides the constructor's for callers whose budget is configurable at runtime. Counted in
   * this process's memory, so with several api workers each enforces its share (ApiWorkers.share).
   */
  check(key: string, limit: number = this.limit): boolean {
    const budget = ApiWorkers.share(limit);
    const now = Date.now();
    let record = this.counts.get(key);

    if (!record || now > record.resetAt) {
      record = { count: 1, resetAt: now + this.windowMs };
      this.counts.set(key, record);
      return true;
    }

    if (record.count >= budget) {
      return false;
    }

    record.count++;
    return true;
  }

  getRemaining(key: string): number {
    const record = this.counts.get(key);
    if (!record || Date.now() > record.resetAt) return this.limit;
    return Math.max(0, this.limit - record.count);
  }
}