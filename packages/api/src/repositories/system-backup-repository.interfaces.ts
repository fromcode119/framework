export interface SystemBackupAuditRecord {
  action: string;
  resource: string;
  status: 'allowed' | 'denied' | 'violation';
  metadata?: Record<string, unknown>;
}