import { Logger } from '../logging/logger';
import { IDatabaseManager, sql } from '@fromcode/database';

export class AuditManager {
  private logger = new Logger({ namespace: 'Audit' });

  constructor(private db: IDatabaseManager) {}

  public async logAction(
    pluginSlug: string,
    action: string,
    resource: string,
    status: 'allowed' | 'denied' | 'violation',
    metadata?: any
  ) {
    this.logger.info(`[${status.toUpperCase()}] Plugin "${pluginSlug}" performed ${action} on ${resource}`);

    try {
      await this.db.insert('_system_audit_logs', {
        plugin_slug: pluginSlug,
        action,
        resource,
        status,
        metadata: metadata ? JSON.stringify(metadata) : null,
        created_at: new Date()
      });
    } catch (e) {
      this.logger.error(`Failed to write audit log: ${e}`);
    }
  }
}
