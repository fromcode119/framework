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
}
