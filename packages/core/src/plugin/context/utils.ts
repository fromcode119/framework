import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import { Logger } from '@core/logging';
import { PluginPermissionsService } from '@core/security/plugin-permissions-service';
import { PluginApprovalCoverage } from '@core/plugin/consent/plugin-approval-coverage';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';

export class ContextSecurityProxy {
  static createSecurityHelpers(plugin: ILoadedPlugin, manager: IPluginManagerInterface, rootLogger: Logger) {
      // Declared AND approved: a plugin whose manifest asks for anything nobody approved gets nothing,
      // even if its code is reached some other way than its lifecycle hooks (PluginConsentSet).
      const hasCapability = (cap: string) =>
        PluginApprovalCoverage.covers(plugin) && (
          PluginPermissionsService.hasPermission(plugin.manifest, cap) ||
          Boolean(plugin.manifest.capabilities?.includes('*')));

      const handleViolation = (cap: string) => {
        rootLogger.error(`Security Violation: Plugin "${plugin.manifest.slug}" attempted to use "${cap}" without declaration or approval.`);
        manager.audit.logAction(plugin.manifest.slug, 'Capability Check', cap, 'violation');
        manager.disableWithError(plugin.manifest.slug, `Security Violation: Missing "${cap}" capability.`);
        throw new Error(`Security Violation: Missing "${cap}" capability.`);
      };

      const handleRateLimit = (type: string) => {
        rootLogger.warn(`Rate Limit Exceeded: Plugin "${plugin.manifest.slug}" reached ${type} quota.`);
        manager.audit.logAction(plugin.manifest.slug, 'Rate Limit', type, 'denied');
        throw new Error(`Rate Limit Exceeded: Plugin "${plugin.manifest.slug}" reached ${type} quota.`);
      };

      return { hasCapability, handleViolation, handleRateLimit };

  }
}