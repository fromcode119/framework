/**
 * The activity log bucketed per day, and the judgement of what that is worth drawing.
 *
 * A chart is a claim about a SHAPE. Two points make a line whatever the data says, and one point
 * makes a vertical stroke — which is exactly what a fresh installation's dashboard drew for its
 * single "admin account created" event, next to a 14-day axis. The window decides which of three
 * honest forms the panel takes; the panel only renders what it is told.
 */
export class DashboardActivityWindow {
  /** Below this many days WITH events, a line is drawing a trend nobody measured. */
  static readonly SHAPE_THRESHOLD = 4;

  readonly buckets: Array<{ key: string; label: string; total: number; errors: number }>;

  private constructor(buckets: DashboardActivityWindow['buckets']) {
    this.buckets = buckets;
  }

  static build(activity: Array<{ timestamp?: string | number; level?: string }>, days: number): DashboardActivityWindow {
    const buckets: DashboardActivityWindow['buckets'] = [];
    const index: Record<string, number> = {};
    const now = new Date();
    for (let offset = days - 1; offset >= 0; offset--) {
      const day = new Date(now);
      day.setDate(day.getDate() - offset);
      const key = day.toISOString().slice(0, 10);
      index[key] = buckets.length;
      buckets.push({ key, label: day.toLocaleDateString([], { month: 'short', day: 'numeric' }), total: 0, errors: 0 });
    }

    for (const entry of activity || []) {
      if (!entry?.timestamp) continue;
      const position = index[new Date(entry.timestamp).toISOString().slice(0, 10)];
      if (position === undefined) continue;
      buckets[position].total += 1;
      if (String(entry.level).toUpperCase() === 'ERROR') buckets[position].errors += 1;
    }

    return new DashboardActivityWindow(buckets);
  }

  get totalEvents(): number {
    return this.buckets.reduce((sum, bucket) => sum + bucket.total, 0);
  }

  get totalErrors(): number {
    return this.buckets.reduce((sum, bucket) => sum + bucket.errors, 0);
  }

  /** Days that actually carry events — the only thing that can give a line its shape. */
  get daysWithEvents(): number {
    return this.buckets.filter((bucket) => bucket.total > 0).length;
  }

  get isEmpty(): boolean {
    return this.totalEvents === 0;
  }

  get hasShape(): boolean {
    return this.daysWithEvents >= DashboardActivityWindow.SHAPE_THRESHOLD;
  }

  /** The recent tail, for the bar form: enough to compare, short enough to read unlabelled. */
  recentBuckets(count: number): DashboardActivityWindow['buckets'] {
    return this.buckets.slice(-count);
  }

  /** "since Tuesday" — the first day that carries anything, which is when this install woke up. */
  get firstActiveLabel(): string {
    return this.buckets.find((bucket) => bucket.total > 0)?.label ?? '';
  }
}
