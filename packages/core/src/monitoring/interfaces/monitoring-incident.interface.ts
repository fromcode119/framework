/**
 * One platform incident, as stored and as handed to providers. Facts only — the words a person reads
 * come from the email template and the admin's translations, keyed by `kind`.
 */
export interface IMonitoringIncident {
  /** Unique while open: the kind plus its subject, e.g. `site-down:shop` or `disk-full`. */
  key: string;
  /** A `MonitoringIncidentKind` value. */
  kind: string;
  /** What the incident is about, when it is about one thing: a plugin slug, a site slug. */
  subject?: string;
  /** What was measured: `percent`, `threshold`, `url`, `status`, `reason`, ... by kind. */
  values: Record<string, string | number>;
  openedAt: string;
  resolvedAt?: string;
  /**
   * How many checks in a row have found it, while it is still waiting to be announced. A disk or memory
   * share is announced only once it is found on `PlatformHealthChecks.SHARE_CONFIRM_CHECKS` checks in a
   * row; absent once announced (and on incidents stored before this existed).
   */
  pendingChecks?: number;
}
