import { Logger } from '@fromcode119/sdk';
import { IDatabaseManager, sql } from '@fromcode119/database';
import { SystemConstants } from '@fromcode119/sdk';

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
      await this.db.insert(SystemConstants.TABLE.AUDIT_LOGS, {
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