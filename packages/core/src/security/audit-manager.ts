import { AuditOutcome } from '@core/security/enums/audit-outcome.enum';
import { Logger } from '@core/logging';
import { IDatabaseManager } from '@fromcode119/database';
import { SystemConstants } from '@core/constants/system.constants';
import { AuditResourceRedactor } from '@core/security/audit-resource-redactor';

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
    // Printed and stored: an address loses its query values and userinfo before either.
    const safeResource = AuditResourceRedactor.redact(resource);
    this.logger.info(`[${outcome.value.toUpperCase()}] Plugin "${pluginSlug}" performed ${action} on ${safeResource}`);

    try {
      await this.db.insert(SystemConstants.TABLE.AUDIT_LOGS, {
        plugin_slug: pluginSlug,
        action,
        resource: safeResource,
        status: outcome.value,
        metadata: metadata ? JSON.stringify(metadata) : null,
        created_at: new Date()
      });
    } catch (e) {
      this.logger.error(`Failed to write audit log: ${e}`);
    }
  }
}