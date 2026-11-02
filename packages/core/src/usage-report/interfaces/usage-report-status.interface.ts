/** The outcome of the last send, shown beside the switch. */
export interface IUsageReportStatus {
  at: string;
  ok: boolean;
  target: string;
  message: string;
}
