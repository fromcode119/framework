/**
 * Platform monitoring (Settings → Infrastructure → Monitoring). Part of `SystemConstants.META_KEY` —
 * spread into `SystemMetaKeys.ALL` — and split out only for size.
 */
export class MonitoringMetaKeys {
  static readonly ALL = {
    /** Alert when the server's disk is at least this full, in percent. */
    MONITORING_DISK_PERCENT: 'monitoring_disk_percent',
    /** Alert when the server's memory is at least this full, in percent. */
    MONITORING_MEMORY_PERCENT: 'monitoring_memory_percent',
    /** Alert when at least this share of api requests failed with a server error since the last check, in percent. */
    MONITORING_API_ERROR_PERCENT: 'monitoring_api_error_percent',
    /** The incidents open right now — written by the monitor, shown read-only on the Health page. */
    MONITORING_OPEN_INCIDENTS: 'monitoring_open_incidents',
    /** The addresses last handed to the external providers, so a change in the site list is noticed. */
    MONITORING_SYNCED_TARGETS: 'monitoring_synced_targets',
  } as const;
}
