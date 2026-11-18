/** One plugin's offer to provide a capability (e.g. a `payment.method` called `mypos`). */
export interface ICapabilityProvider {
  /** The capability this provides, e.g. `payment.method`, `tax.calculator`, `shipping.quote`. */
  capability: string;
  /** The providing plugin's slug — set by the framework from the caller, never by the caller. */
  slug: string;
  /** The providing plugin's vendor namespace, so a consumer can call it through `context.plugins`. */
  namespace?: string;
  /** A stable id for THIS provider of the capability (e.g. `mypos`), when a plugin offers several. */
  id?: string;
  /** A human label for the console and for a chooser. */
  label?: string;
  /**
   * A weak ordering HINT (clamped to 0–100), not a decision: it may order a list, but it must never be
   * trusted to pick the active provider of a sensitive capability — a plugin could set a high priority to
   * intercept payments. For those, the operator chooses the active provider; the registry only lists the
   * candidates.
   */
  priority?: number;
}
