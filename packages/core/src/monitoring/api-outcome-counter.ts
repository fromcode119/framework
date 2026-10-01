/**
 * How many api requests finished, and how many of those with a server error, since the last read.
 *
 * Counted per api process: the monitor reads it on the replica that runs the check, which is a sample of
 * the traffic rather than all of it — enough to notice a rising error rate, which is the point.
 */
export class ApiOutcomeCounter {
  private static total = 0;
  private static errors = 0;

  static record(statusCode: number): void {
    ApiOutcomeCounter.total += 1;
    if (statusCode >= 500) ApiOutcomeCounter.errors += 1;
  }

  /** The counts since the last call, and a fresh window. */
  static drain(): { total: number; errors: number } {
    const counts = { total: ApiOutcomeCounter.total, errors: ApiOutcomeCounter.errors };
    ApiOutcomeCounter.total = 0;
    ApiOutcomeCounter.errors = 0;
    return counts;
  }
}
