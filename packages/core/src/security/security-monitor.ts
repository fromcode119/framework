import { IDatabaseManager } from '@fromcode/database';
import { Logger } from '@fromcode/sdk';
import { PluginManager } from '../plugin/plugin-manager';
import { SystemTable } from '@fromcode/sdk/internal';

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
  private logger = new Logger({ namespace: 'security-monitor' });
  private interval: NodeJS.Timeout | null = null;

  constructor(
    private db: IDatabaseManager,
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

    const [recentViolations, recentDenials] = await Promise.all([
      this.db.find(SystemTable.AUDIT_LOGS, { where: { status: 'violation' }, orderBy: { created_at: 'desc' }, limit: 2000 }),
      this.db.find(SystemTable.AUDIT_LOGS, { where: { status: 'denied' }, orderBy: { created_at: 'desc' }, limit: 2000 })
    ]);

    const violations24h = recentViolations.filter(r => new Date(r.created_at) >= twentyFourHoursAgo);
    const denials24h = recentDenials.filter(r => new Date(r.created_at) >= twentyFourHoursAgo);

    const pluginCounts = new Map<string, number>();
    for (const row of [...violations24h, ...denials24h]) {
      const slug = row.plugin_slug;
      if (slug) pluginCounts.set(slug, (pluginCounts.get(slug) ?? 0) + 1);
    }

    const suspiciousPlugins = Array.from(pluginCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([slug, count]) => ({ slug, count }));

    return {
      violations24h: violations24h.length,
      denials24h: denials24h.length,
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

    const recentDenials = await this.db.find(SystemTable.AUDIT_LOGS, {
      where: { status: 'denied' },
      orderBy: { created_at: 'desc' },
      limit: 1000
    });

    const inWindow = recentDenials.filter(r => new Date(r.created_at) >= fiveMinutesAgo);

    const pluginCounts = new Map<string, number>();
    for (const row of inWindow) {
      const slug = row.plugin_slug;
      if (slug) pluginCounts.set(slug, (pluginCounts.get(slug) ?? 0) + 1);
    }

    for (const [pluginSlug, denialCount] of pluginCounts) {
      if (denialCount <= 10) continue;

      this.logger.warn(`SECURITY ALERT: Denial spike detected for plugin "${pluginSlug}" (${denialCount} denials in 5m)`);

      await this.db.update(SystemTable.PLUGINS, { slug: pluginSlug }, {
        health_status: 'warning',
        updated_at: new Date()
      });

      await this.logSecurityEvent({
        type: 'denial_spike',
        pluginSlug,
        severity: 'medium',
        details: `Detected ${denialCount} permission denials in the last 5 minutes. This may indicate an attempt to probe system boundaries.`,
        metadata: { count: denialCount }
      });
    }
  }

  /**
   * Look for any 'violation' status logs (these are high severity by definition)
   */
  private async checkViolations() {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

    const recentViolations = await this.db.find(SystemTable.AUDIT_LOGS, {
      where: { status: 'violation' },
      orderBy: { created_at: 'desc' },
      limit: 200
    });

    const violations = recentViolations.filter(r => new Date(r.created_at) >= oneMinuteAgo);

    for (const violation of violations) {
      this.logger.error(`SECURITY VIOLATION: Plugin "${violation.plugin_slug}" attempted ${violation.action} on ${violation.resource}`);

      await this.db.update(SystemTable.PLUGINS, { slug: violation.plugin_slug }, {
        health_status: 'error',
        updated_at: new Date()
      });

      await this.logSecurityEvent({
        type: 'violation',
        pluginSlug: violation.plugin_slug,
        severity: 'high',
        details: `Resource access violation: Attempted ${violation.action} on unauthorized resource ${violation.resource}.`,
        metadata: violation.metadata
      });

      if (process.env.AUTO_PROTECT === 'true') {
        this.logger.info(`AUTO-PROTECT: Disabling compromised plugin "${violation.plugin_slug}"`);
        await this.pluginManager.disable(violation.plugin_slug);
      }
    }
  }

  private async logSecurityEvent(event: SecurityEvent) {
    // Write a system log about the security event itself
    await this.db.insert(SystemTable.LOGS, {
      plugin_slug: 'security-monitor',
      level: event.severity === 'critical' ? 'ERROR' : 'WARN',
      message: `[SECURITY ${event.type.toUpperCase()}] Plugin "${event.pluginSlug}": ${event.details}`,
      context: JSON.stringify(event.metadata || {}),
      timestamp: new Date()
    });
  }
}
