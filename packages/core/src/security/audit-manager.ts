import { AuditOutcome } from '@core/security/enums/audit-outcome.enum';
import { Logger } from '@core/logging';
import { IDatabaseManager } from '@fromcode119/database';
import { SystemConstants } from '@core/constants/system.constants';

export class AuditManager {
  private logger = new Logger({ namespace: 'Audit' });

  constructor(private db: IDatabaseManager) {}

  public async logAction(
    pluginSlug: string,
    action: string,
    resource: string,
    status: AuditOutcome | string,
    metadata?: any
  ) {
    // Plugins are compiled separately and pass the raw wire string, so hydrate at this boundary.
    const outcome = AuditOutcome.resolve(status);
    this.logger.info(`[${outcome.value.toUpperCase()}] Plugin "${pluginSlug}" performed ${action} on ${resource}`);

    try {
      await this.db.insert(SystemConstants.TABLE.AUDIT_LOGS, {
        plugin_slug: pluginSlug,
        action,
        resource,
        status: outcome.value,
        metadata: metadata ? JSON.stringify(metadata) : null,
        created_at: new Date()
      });
    } catch (e) {
      this.logger.error(`Failed to write audit log: ${e}`);
    }
  }
}