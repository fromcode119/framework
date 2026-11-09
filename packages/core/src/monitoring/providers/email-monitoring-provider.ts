import { NotificationsContextProxy } from '@core/plugin/context/notifications';
import { PluginEmailTemplateFileService } from '@core/plugin/services/plugin-email-template-file-service';
import { MonitoringChange } from '@core/monitoring/enums/monitoring-change.enum';
import { MonitoringIncidentKind } from '@core/monitoring/enums/monitoring-incident-kind.enum';
import type { IMonitoringIncident } from '@core/monitoring/interfaces/monitoring-incident.interface';
import type { IMonitoringProvider } from '@core/monitoring/interfaces/monitoring-provider.interface';
import { FrameworkAdminAlerts } from '@core/email/framework-admin-alerts';

/**
 * The built-in provider: each incident, opened and resolved, to the addresses entered on the provider in
 * Settings → Integrations → Monitoring, plus the platform's admins and its notification address — the same
 * recipients as every other platform warning.
 */
export class EmailMonitoringProvider implements IMonitoringProvider {
  private static readonly TEMPLATE_BASE = 'monitoring-incident';

  constructor(private readonly manager: any, private readonly extraRecipients: string[] = []) {}

  /** Everyone an incident reaches, for the console to show. */
  recipients(): Promise<string[]> {
    return NotificationsContextProxy.adminRecipients(this.manager, this.extraRecipients);
  }

  async notify(incident: IMonitoringIncident, change: MonitoringChange): Promise<void> {
    // One flag per kind: the template holds the words for each, and the measured values fill them in.
    const message = PluginEmailTemplateFileService.renderEmail(EmailMonitoringProvider.TEMPLATE_BASE, {
      ...incident.values,
      subject: incident.subject ?? '',
      openedAt: incident.openedAt,
      resolvedAt: incident.resolvedAt ?? '',
      isResolved: change === MonitoringChange.RESOLVED,
      isPluginUnhealthy: incident.kind === MonitoringIncidentKind.PLUGIN_UNHEALTHY.value,
      isSiteDown: incident.kind === MonitoringIncidentKind.SITE_DOWN.value,
      isDiskFull: incident.kind === MonitoringIncidentKind.DISK_FULL.value,
      isMemoryFull: incident.kind === MonitoringIncidentKind.MEMORY_FULL.value,
      isApiErrors: incident.kind === MonitoringIncidentKind.API_ERRORS.value,
    });
    await NotificationsContextProxy.createNotificationsProxy(this.manager, 'system').notifyAdmins(message, { extraRecipients: this.extraRecipients, category: FrameworkAdminAlerts.MONITORING });
  }
}
