/** The update to perform now (`target`, '' for none) and why, in a word the screen and the updater both read. */
export interface IAutomaticUpdatePlan {
  current: string;
  target: string;
  /** `requested` | `automatic` | `heldBreaking` | `heldFailed` | `off` | `current` | `unknown` */
  reason: string;
  /** The version that holds an automatic update back (breaking, or failed here before); '' when none. */
  heldBy: string;
}
