/** What the gateway sends when it stops an address (`POST /internal/edge/stops`). */
export interface IEdgeStopReport {
  address: string;
  reason: string;
  /** ISO time the stop ends. */
  until: string;
  /** How many refusals earned it. */
  strikes: number;
  /** The hosts it tried and the paths it asked for while it earned it. */
  hosts: string[];
  paths: string[];
}
