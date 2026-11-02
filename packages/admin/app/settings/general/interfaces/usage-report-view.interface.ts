/** What `GET …/admin/usage-report` answers: the switch, the target URL, the exact report and the last outcome. */
export interface UsageReportView {
  enabled: boolean;
  target: string;
  report: Record<string, unknown>;
  status: { at: string; ok: boolean; target: string; message: string } | null;
}
