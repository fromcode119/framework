import { IDatabaseManager } from '@fromcode119/database';
import { SystemConstants } from '@fromcode119/core';
import type { ISystemBackupAuditRecord } from '@api/repositories/interfaces/system-backup-audit-record.interface';

export class SystemBackupRepository {
  constructor(private readonly db: IDatabaseManager) {}

  async recordOperation(record: ISystemBackupAuditRecord): Promise<void> {
    await this.db.insert(SystemConstants.TABLE.AUDIT_LOGS, {
      pluginSlug: 'system',
      action: record.action,
      resource: record.resource,
      status: record.status,
      metadata: record.metadata || null,
      createdAt: new Date(),
    });
  }
}