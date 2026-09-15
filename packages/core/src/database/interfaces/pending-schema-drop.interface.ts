/**
 * A column the database has that nothing declares, waiting for a human decision.
 *
 * The counts are the whole point. An operator looking at
 *
 *     fcp_finance_invoices
 *       + issued_at        added
 *       ? invoice_date     46 of 46 rows · sample 2026-05-15 07:58:15
 *
 * is asking one question — is that data already in the new column, or am I about to lose it? — and
 * `rows`, `nonNull` and `sample` are what answer it.
 */
export interface IPendingSchemaDrop {
  table: string;
  column: string;
  /**
   * Summed across every tenant — one connection cannot see them all under FORCE row-level security.
   *
   * OPTIONAL because they are taken when an operator LOOKS, not when the column is first noticed:
   * counting is expensive, the numbers would be stale by the time anyone read them, and counting
   * during schema sync opened tenant scopes that broke the untenanted write which follows it.
   * Absent means "not counted", and the admin must say so rather than render a zero — a zero reads
   * as "safe to drop", which is the one thing that must never be guessed.
   */
  rows?: number;
  nonNull?: number;
  /** Rows holding something that is not NULL and not blank — what is actually at stake. */
  nonEmpty?: number;
  /** One value, truncated, to recognise the data by. Empty when the column holds none. */
  sample?: string;
  /** When this was first noticed, so a queue nobody works is visibly old rather than merely long. */
  firstSeenAt: string;

  /**
   * Installed plugins that were NOT active when this was found.
   *
   * A field can be declared conditionally — ecommerce declares `licenseProduct` on products only
   * when the licensing plugin is active — so with one switched off its column looks undeclared while
   * still holding every row it ever wrote. The operator approving a drop is the only one who knows
   * whether a disabled plugin is coming back, and they can only know it if they are told.
   *
   * Empty means the declared picture was complete and the finding stands on its own.
   */
  inactivePluginsAtScan?: string[];
}
