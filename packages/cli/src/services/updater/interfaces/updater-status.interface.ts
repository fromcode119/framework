/** What the updater reports about the update it is doing or last did. */
export interface IUpdaterStatus {
  state: string;
  from: string;
  to: string;
  startedAt: string;
  finishedAt: string;
  /** The step in progress, in words an operator can read. */
  step: string;
  steps: string[];
  error: string;
  /** `rolling` or `restart` — how the apps were replaced; empty until the run has chosen. */
  deployMode: string;
  /** Why that mode: the operator's setting, a migration, or the memory the box has. */
  deployReason: string;
}
