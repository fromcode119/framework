import { DatabaseManager, sql, eq, count, and, or, desc, gte, systemAuditLogs } from '@fromcode/database';
import { Logger } from '../logging/logger';
import { PluginManager } from '../plugin/manager';

export interface SecurityEvent {
  type: 'anomaly' | 'violation' | 'denial_spike';
  pluginSlug: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: string;
  metadata?: any;
}

/**
 * SecurityMonitor analyzes audit logs for suspicious patterns
 * and can trigger automatic responses (e.g. disabling a plugin).
 */
export class SecurityMonitor {
  private logger = new Logger({ namespace: 'SecurityMonitor' });
  private interval: NodeJS.Timeout | null = null;

  constructor(
    private db: DatabaseManager,
    private pluginManager: PluginManager
  ) {}

  public start(intervalMs = 60000) {
    this.logger.info(`Starting SecurityMonitor with ${intervalMs}ms interval`);
    this.interval = setInterval(() => this.runCheck(), intervalMs);
  }

  public stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  public async getSecurityStats() {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const violationCount = await this.db.drizzle
      .select({ value: count() })
      .from(systemAuditLogs)
      .where(
        and(
          eq(systemAuditLogs.status, 'violation'),
          gte(systemAuditLogs.createdAt, twentyFourHoursAgo)
        )
      );

    const denialCount = await this.db.drizzle
      .select({ value: count() })
      .from(systemAuditLogs)
      .where(
        and(
          eq(systemAuditLogs.status, 'denied'),
          gte(systemAuditLogs.createdAt, twentyFourHoursAgo)
        )
      );

    const suspiciousPlugins = await this.db.drizzle
      .select({
        slug: systemAuditLogs.pluginSlug,
        count: count()
      })
      .from(systemAuditLogs)
      .where(
        and(
          or(eq(systemAuditLogs.status, 'denied'), eq(systemAuditLogs.status, 'violation')),
          gte(systemAuditLogs.createdAt, twentyFourHoursAgo)
        )
      )
      .groupBy(systemAuditLogs.pluginSlug)
      .orderBy(desc(count()))
      .limit(5);

    return {
      violations24h: Number(violationCount[0]?.value || 0),
      denials24h: Number(denialCount[0]?.value || 0),
      suspiciousPlugins
    };
  }

  private async runCheck() {
    this.logger.debug('Running security heuristics check...');
    
    try {
      await this.checkDenialSpikes();
      await this.checkViolations();
    } catch (e) {
      this.logger.error(`Security check failed: ${e}`);
    }
  }

  /**
   * Look for plugins that have excessive 'denied' results in a short period
   */
  private async checkDenialSpikes() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    // Using Drizzle to aggregate
    const results = await this.db.drizzle
      .select({
        pluginSlug: systemAuditLogs.pluginSlug,
        denialCount: count(),
      })
      .from(systemAuditLogs)
      .where(
        and(
          eq(systemAuditLogs.status, 'denied'),
          gte(systemAuditLogs.createdAt, fiveMinutesAgo)
        )
      )
      .groupBy(systemAuditLogs.pluginSlug)
      .having(({ denialCount }: any) => sql`${denialCount} > 10`);

    for (const row of results) {
      this.logger.warn(`SECURITY ALERT: Denial spike detected for plugin "${row.pluginSlug}" (${row.denialCount} denials in 5m)`);
      
      // Update health status in DB
      await this.db.update('_system_plugins', { slug: row.pluginSlug }, { 
        health_status: 'warning',
        updated_at: new Date()
      });

      await this.logSecurityEvent({
        type: 'denial_spike',
        pluginSlug: row.pluginSlug,
        severity: 'medium',
        details: `Detected ${row.denialCount} permission denials in the last 5 minutes. This may indicate an attempt to probe system boundaries.`,
        metadata: { count: row.denialCount }
      });
    }
  }

  /**
   * Look for any 'violation' status logs (these are high severity by definition)
   */
  private async checkViolations() {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

    const violations = await this.db.drizzle
      .select()
      .from(systemAuditLogs)
      .where(
        and(
          eq(systemAuditLogs.status, 'violation'),
          gte(systemAuditLogs.createdAt, oneMinuteAgo)
        )
      );

    for (const violation of violations) {
      this.logger.error(`SECURITY VIOLATION: Plugin "${violation.pluginSlug}" attempted ${violation.action} on ${violation.resource}`);
      
      // Update health status to ERROR
      await this.db.update('_system_plugins', { slug: violation.pluginSlug }, { 
        health_status: 'error',
        updated_at: new Date()
      });

      await this.logSecurityEvent({
        type: 'violation',
        pluginSlug: violation.pluginSlug,
        severity: 'high',
        details: `Resource access violation: Attempted ${violation.action} on unauthorized resource ${violation.resource}.`,
        metadata: violation.metadata
      });

      // AUTOMATIC RESPONSE: For high-severity violations, we can automatically disable the plugin
      if (process.env.AUTO_PROTECT === 'true') {
        this.logger.info(`AUTO-PROTECT: Disabling compromised plugin "${violation.pluginSlug}"`);
        await this.pluginManager.disable(violation.pluginSlug);
      }
    }
  }

  private async logSecurityEvent(event: SecurityEvent) {
    // Write a system log about the security event itself
    await this.db.insert('_system_logs', {
      plugin_slug: 'security-monitor',
      level: event.severity === 'critical' ? 'ERROR' : 'WARN',
      message: `[SECURITY ${event.type.toUpperCase()}] Plugin "${event.pluginSlug}": ${event.details}`,
      context: JSON.stringify(event.metadata || {}),
      timestamp: new Date()
    });
  }
}
