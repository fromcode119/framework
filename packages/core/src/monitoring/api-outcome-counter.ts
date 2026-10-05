/**
 * How many api requests finished, and how many of those with a server error, since the last read — and
 * which routes those errors came from, so an alert says whether visitors were hit or only internal polling.
 *
 * Counted per api process: the monitor reads it on the replica that runs the check, which is a sample of
 * the traffic rather than all of it — enough to notice a rising error rate, which is the point.
 */
export class ApiOutcomeCounter {
  /** How many failing routes an incident names. */
  static readonly TOP_ROUTES = 5;
  /** Distinct failing routes remembered per window; past this, errors still count but are not attributed. */
  private static readonly MAX_ROUTES = 200;
  private static readonly MAX_SEGMENTS = 8;

  private static total = 0;
  private static errors = 0;
  private static failing = new Map<string, number>();
  private static refusals = new WeakSet<object>();

  /**
   * Marks a response whose 5xx status IS the answer — a private site, maintenance, a suspended tenant —
   * so it counts as answered rather than failed. A crawler on a private site would otherwise read as
   * the api failing half its requests.
   */
  static refused(res: object): void {
    ApiOutcomeCounter.refusals.add(res);
  }

  static isRefusal(res: object): boolean {
    return ApiOutcomeCounter.refusals.has(res);
  }

  static record(statusCode: number, method = '', url = '', refused = false): void {
    ApiOutcomeCounter.total += 1;
    if (statusCode < 500 || refused) return;
    ApiOutcomeCounter.errors += 1;
    const route = ApiOutcomeCounter.route(method, url);
    if (!route) return;
    const seen = ApiOutcomeCounter.failing.get(route);
    if (seen === undefined && ApiOutcomeCounter.failing.size >= ApiOutcomeCounter.MAX_ROUTES) return;
    ApiOutcomeCounter.failing.set(route, (seen ?? 0) + 1);
  }

  /** The counts since the last call, the routes that failed most, and a fresh window. */
  static drain(): { total: number; errors: number; failing: Array<{ route: string; count: number }> } {
    const failing = Array.from(ApiOutcomeCounter.failing, ([route, count]) => ({ route, count }))
      .sort((a, b) => b.count - a.count || a.route.localeCompare(b.route))
      .slice(0, ApiOutcomeCounter.TOP_ROUTES);
    const counts = { total: ApiOutcomeCounter.total, errors: ApiOutcomeCounter.errors, failing };
    ApiOutcomeCounter.total = 0;
    ApiOutcomeCounter.errors = 0;
    ApiOutcomeCounter.failing = new Map();
    return counts;
  }

  /**
   * `GET /api/v1/orders/:id` — the method and the path without its query, with every segment that names
   * one record (a number, a uuid, a long token) folded to `:id`. Ids and tokens never reach an email, and
   * one failing endpoint reads as one route rather than a thousand.
   */
  static route(method: string, url: string): string {
    const path = String(url ?? '').split(/[?#]/)[0];
    if (!path) return '';
    const segments = path.split('/').filter(Boolean).slice(0, ApiOutcomeCounter.MAX_SEGMENTS).map((segment) => ApiOutcomeCounter.isIdentifier(segment) ? ':id' : segment);
    return `${String(method ?? '').toUpperCase()} /${segments.join('/')}`.trim();
  }

  private static isIdentifier(segment: string): boolean {
    return /^\d+$/.test(segment)
      || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)
      || /^[0-9a-f]{16,}$/i.test(segment)
      || (segment.length >= 24 && /\d/.test(segment))
      || segment.length > 64;
  }
}
