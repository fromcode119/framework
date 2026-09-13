/**
 * How long to wait before trying a host again.
 *
 * THIS CLASS IS THE RATE LIMIT. Let's Encrypt refuses a hostname after five failed validations in an
 * hour, and the refusal outlasts whatever was actually wrong — so a naive retry loop turns a
 * five-minute misconfiguration into an hour of being locked out of fixing it. Doubling from two
 * hours keeps a single host to well under one validation per hour however long it stays broken.
 *
 * The cap exists so a domain somebody pointed at us and then forgot about is retried daily forever
 * rather than drifting out to weeks — when they finally fix their DNS, it should notice that day.
 */
export class CertificateIssuanceBackoff {
  private static readonly FIRST_DELAY_MS = 2 * 60 * 60 * 1000;
  private static readonly MAX_DELAY_MS = 24 * 60 * 60 * 1000;

  /** Waits that cost the authority nothing, so they stay short: DNS that does not point here yet. */
  static readonly DNS_RECHECK_MS = 5 * 60 * 1000;
  /** Our own challenge path being unreachable is our problem to fix, and cheap to re-test. */
  static readonly UNREACHABLE_RECHECK_MS = 10 * 60 * 1000;

  /**
   * When to try again after `failures` consecutive failed attempts.
   *
   * `failures` is the count INCLUDING the one that just happened, so the first failure waits two
   * hours rather than none.
   */
  static nextAttemptAfter(failures: number, from: Date = new Date()): Date {
    const attempts = Math.max(1, Math.floor(failures));
    const doubled = CertificateIssuanceBackoff.FIRST_DELAY_MS * Math.pow(2, attempts - 1);
    const delay = Math.min(doubled, CertificateIssuanceBackoff.MAX_DELAY_MS);
    return new Date(from.getTime() + delay);
  }

  /** A short, fixed wait — for the failures that never reach the authority. */
  static after(delayMs: number, from: Date = new Date()): Date {
    return new Date(from.getTime() + delayMs);
  }
}
