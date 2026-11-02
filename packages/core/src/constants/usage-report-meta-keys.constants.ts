/**
 * The usage report (Settings → General → Usage report). Part of `SystemConstants.META_KEY` — spread into
 * `SystemMetaKeys.ALL` — and split out only for size.
 */
export class UsageReportMetaKeys {
  static readonly ALL = {
    /** The operator's switch. Off unless they turn it on: nothing is sent by default. */
    USAGE_REPORT_ENABLED: 'usage_report_enabled',
    /** Where the report goes. Blank uses `UsageReportDefaults.ADDRESS`, which the admin states beside the field. */
    USAGE_REPORT_URL: 'usage_report_url',
    /** The random id the report carries, made the first time a report is built. Written by the api. */
    USAGE_REPORT_INSTALL_ID: 'usage_report_install_id',
    /** When the last report was sent and how it went. Written by the api, shown read-only. */
    USAGE_REPORT_STATUS: 'usage_report_status',
  } as const;
}
