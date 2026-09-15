/** How a dataset will be erased, and WHO decided that. */
export interface IPersonalDataStrategyChoice {
  /** `pluginSlug:key` — the id every layer stores a choice against. */
  id: string;
  /** The strategy that will actually be applied. */
  strategy: string;
  /** The operator's stated legal basis. Required when the strategy is `retain`. */
  reason: string;
  /**
   * Which layer decided — a {@link PersonalDataPolicyLayer} value, carried as its plain string.
   *
   * A string and not the enum instance itself: this crosses the structured-clone channel to an
   * isolated plugin, and a class instance does not survive that.
   */
  source: string;
  /** What an operator is shown, naming where the value came from. Never empty. */
  provenance: string;
  /** Set when a stored choice could not be honoured, so the operator is told rather than overridden. */
  problem: string;
}
