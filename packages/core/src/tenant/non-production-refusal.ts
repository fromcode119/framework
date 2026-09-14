/**
 * Thrown when a non-production site tries to reach the outside world.
 *
 * It THROWS rather than returning a quiet success on purpose. A staging checkout that appears to
 * charge a card and did not, or an order that reports "confirmation sent" to nobody, is worse than
 * one that visibly refuses: the first is discovered weeks later by a customer, the second in the next
 * five seconds by whoever is testing.
 *
 * The message names the control that lifts it, because an operator who meets this error needs to know
 * it is a setting and not a fault (Rule Zero).
 */
export class NonProductionRefusal extends Error {
  constructor(
    /** Which brake refused: `email`, `network` or `scheduler`. */
    readonly effect: string,
    /** The site that refused, by slug — what the operator sees in the Sites list. */
    readonly tenantSlug: string,
    /** What was being reached: a recipient address, a URL, a task name. */
    readonly target: string,
  ) {
    super(
      `Blocked: this site is marked non-production, so ${effect} cannot leave it `
      + `(attempted: ${target}). Change it at Sites → ${tenantSlug} → Environment.`,
    );
    this.name = 'NonProductionRefusal';
  }
}
