/** How one update run ended. `state` is an `UpdaterState` value. */
export interface IUpdateOutcome {
  state: string;
  error: string;
}
