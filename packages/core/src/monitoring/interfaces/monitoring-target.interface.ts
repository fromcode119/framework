/** One address an external provider should watch from outside: a site, or the platform's own health check. */
export interface IMonitoringTarget {
  /** Stable across runs: a site's id, or `platform`. */
  key: string;
  /** What the provider shows as the monitor's name (before the configured prefix). */
  label: string;
  url: string;
}
