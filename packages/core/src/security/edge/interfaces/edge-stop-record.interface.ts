/** One stopped address as Settings → Security → Stopped addresses shows it. */
export interface IEdgeStopRecord {
  id: number;
  address: string;
  reason: string;
  strikes: number;
  /** Requests refused from it while the stop lasted. */
  refused: number;
  hosts: string[];
  paths: string[];
  stoppedAt: string;
  until: string;
  /** Empty while the stop is in force or ended on its own. */
  releasedAt: string;
  releasedBy: string;
  /** `released` or `blocked`. */
  releaseAction: string;
  /** Not released and not yet ended. */
  active: boolean;
  /** Set by `record`: whether this report started a new stop. */
  isNew?: boolean;
}
