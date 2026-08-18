export interface IMcpAuditRecorder {
  record(entry: {
    tool: string;
    userId: string;
    argumentKeys: string[];
    ok: boolean;
    dryRun?: boolean;
    error?: string;
  }): void;
}
