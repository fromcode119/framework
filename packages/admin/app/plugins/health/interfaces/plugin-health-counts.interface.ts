

export interface IPluginHealthCounts {
  total: number;
  active: number;
  held: number;
  error: number;
  inactive: number;
  /** Installed newer than what this api process is serving. Cleared by a restart, not by a fix. */
  restartPending: number;
}
