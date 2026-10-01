/** One pool's counters at a moment: connections open, idle among them, and requests queued for one. */
export interface IDatabasePoolSnapshot {
  /** `requests` for the pool tenant requests use, `platform` for the schema/DDL pool. */
  name: string;
  /** The most connections it may hold right now. */
  max: number;
  total: number;
  idle: number;
  waiting: number;
}
