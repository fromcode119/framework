/**
 * Sends the usage report once a day while Settings → General → Usage report is on (the service checks
 * the switch on every run). An interval rather than a fixed hour, so installations do not all report in
 * the same minute.
 */
export class UsageReportTask {
  static readonly NAME = 'usage-report';
  static readonly SCHEDULE = '1d';
}
