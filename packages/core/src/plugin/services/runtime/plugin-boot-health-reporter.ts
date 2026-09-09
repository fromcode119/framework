import { PluginApprovalMode } from '@core/plugin/services/enums/plugin-approval-mode.enum';
import { Logger } from '@core/logging';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import { NotificationsContextProxy } from '@core/plugin/context/notifications';

import { PluginCapabilityApprovalPolicy } from '@core/plugin/services/security/plugin-capability-approval-policy';
import { PluginRegistryHealth } from '@core/plugin/services/enums/plugin-registry-health.enum';
import { PluginHealthNotificationTemplateService } from '@core/plugin/services/health/plugin-health-notification-template-service';
import type { IPluginHealthNotificationData } from '@core/plugin/services/interfaces/plugin-health-notification-data.interface';
import { PluginHealthReportService } from '@core/plugin/services/health/plugin-health-report-service';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';

/**
 * What boot found wrong: which plugins are HELD on a capability change, what drifted, and the health
 * report an operator reads afterwards.
 *
 * Split out of LifecycleService (429 lines) 2026-09-09.
 */
export class PluginBootHealthReporter {
  constructor(
    private readonly manager: IPluginManagerInterface,
    private readonly logger: Logger,
  ) {}

  /** Pure set-diff of manifest vs approved capabilities. Order-independent; used by the held gate. */
  static computeCapabilityDiff(current: string[], approved: string[]): { added: string[]; removed: string[]; changed: boolean } {
    const cur = new Set(current || []);
    const app = new Set(approved || []);
    const added = [...cur].filter((c) => !app.has(c)).sort();
    const removed = [...app].filter((c) => !cur.has(c)).sort();
    return { added, removed, changed: added.length > 0 || removed.length > 0 };
  }


  /** Decide what to do when a plugin's capabilities drifted from approval: 'auto-approve' (trusted +
   *  opt-in) or 'hold'. Pure wrapper over PluginCapabilityApprovalPolicy for testability. */
  static resolveDriftAction(slug: string, signatureVerified: boolean): PluginApprovalMode {
    return PluginCapabilityApprovalPolicy.shouldAutoApprove(slug, signatureVerified) ? PluginApprovalMode.AUTO_APPROVE : PluginApprovalMode.HOLD;
  }


  /**
   * Collect the held/errored plugins as DATA for the admin alert, or null when everything is healthy.
   * Deliberately returns no markup or copy — `PluginHealthNotificationTemplateService` owns those via
   * Handlebars template files (repo rule: code computes data, template files own the rendering).
   */
  static summarizeHeldPlugins(plugins: Map<string, ILoadedPlugin>): IPluginHealthNotificationData | null {
    const flagged = [...plugins.values()].filter(
      (p) => p.healthStatus === PluginRegistryHealth.WARNING || p.healthStatus === PluginRegistryHealth.ERROR || p.state === PluginState.ERROR,
    );
    if (!flagged.length) return null;

    return {
      count: flagged.length,
      plugins: flagged.map((p) => {
        const isError = p.state === PluginState.ERROR || p.healthStatus === PluginRegistryHealth.ERROR;
        // Pass raw values through — the fallback WORDING ("held", "failed to register") is copy and
        // lives in the template, not here.
        return {
          slug: p.manifest?.slug,
          held: !isError,
          reason: p.heldReason,
          error: p.error,
        };
      }),
    };
  }


  /** After a discovery pass, alert admins ONCE if any plugin is held/errored. Best-effort, never throws. */
  async reportBootPluginHealth(): Promise<void> {
    try {
      const report = PluginHealthReportService.buildReport(
        [...this.manager.plugins.values()].map((p) => ({
          slug: p.manifest.slug, state: p.state, healthStatus: p.healthStatus, heldReason: p.heldReason,
          error: p.error, manifestCapabilities: (p.manifest.capabilities as string[]) || [], approvedCapabilities: p.approvedCapabilities || [],
        })),
      );
      this.logger.info(`[plugin-health] ${report.counts.active} active, ${report.counts.held} held, ${report.counts.error} error, ${report.counts.inactive} inactive`);
      const summary = PluginBootHealthReporter.summarizeHeldPlugins(this.manager.plugins);
      if (!summary) return;
      const message = PluginHealthNotificationTemplateService.render(summary);
      const notifications = NotificationsContextProxy.createNotificationsProxy(this.manager, 'core');
      await notifications.notifyAdmins({ subject: message.subject, text: message.text, html: message.html });
      this.logger.warn(message.subject);
    } catch (err) {
      this.logger.error('reportBootPluginHealth failed', err as any);
    }
  }
}
