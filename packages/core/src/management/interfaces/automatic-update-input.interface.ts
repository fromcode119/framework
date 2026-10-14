/** What the update decision needs: where the installation is, what exists, and what the operator chose. */
export interface IAutomaticUpdateInput {
  current: string;
  latest: string;
  /** Settings → Updates → Install updates automatically. */
  automatic: boolean;
  /** A version an operator asked for with "Update now"; '' when none is waiting. */
  requested: string;
  /** Every published version newer than `current`, each saying whether its changelog marks it breaking. */
  pending: Array<{ version: string; breaking: boolean }>;
  /** The version the last update tried and could not keep (failed or rolled back); '' when none. */
  failed?: string;
}
