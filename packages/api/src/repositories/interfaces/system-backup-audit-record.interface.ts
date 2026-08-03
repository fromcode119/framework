import { AuditOutcome } from '@fromcode119/core';

export interface ISystemBackupAuditRecord {
  action: string;
  resource: string;
  status: AuditOutcome;
  metadata?: Record<string, unknown>;
}