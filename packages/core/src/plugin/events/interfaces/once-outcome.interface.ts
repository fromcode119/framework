/** The result of EventIdempotency.once. */
export interface IOnceOutcome<T> {
  /** True when `fn` ran this time; false when a previous run had already handled this key. */
  ran: boolean;
  /** True when the effect was skipped because the key was already handled. */
  skipped?: boolean;
  /** The result of `fn`, present only when it ran. */
  result?: T;
}
