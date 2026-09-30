/** What the platform knows about its IP-location database — shown as-is in Settings → Infrastructure. */
export interface IGeoDatabaseStatus {
  /** Whether the operator switched lookups on (`geo_ip_lookup`). */
  enabled: boolean;
  /** The database edition on disk, `YYYY-MM`, or empty when none has been installed. */
  edition: string;
  /** When that edition was installed (ISO), or empty. */
  installedAt: string;
  /** Size of the installed file in bytes, or 0. */
  sizeBytes: number;
  /** The last update attempt (ISO), or empty. */
  lastCheckedAt: string;
  /** Why the last update failed, or empty when it did not. */
  lastError: string;
  /** Who publishes the data and under which licence — required attribution. */
  source: { name: string; url: string; license: string; licenseUrl: string };
}
