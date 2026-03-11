import { LoadedPlugin, PluginContext } from '../../types';
import { Logger } from '../../logging';
import { PluginPermissionsService } from '../../security/plugin-permissions-service';
import type { PluginManagerInterface } from './utils.interfaces';

export class ContextSecurityProxy {
  static createSecurityHelpers(plugin: LoadedPlugin, manager: PluginManagerInterface, rootLogger: Logger) {
      const hasCapability = (cap: string) =>
        PluginPermissionsService.hasPermission(plugin.manifest, cap) ||
        plugin.manifest.capabilities?.includes('*');

      const handleViolation = (cap: string) => {
        rootLogger.error(`Security Violation: Plugin "${plugin.manifest.slug}" attempted to use "${cap}" without declaration.`);
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