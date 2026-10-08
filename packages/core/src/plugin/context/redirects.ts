import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { ContextSecurityProxy } from '@core/plugin/context/utils';
import type { IPluginRedirectRule } from '@core/plugin/interfaces/plugin-redirect-rule.interface';
import type { IPluginRedirectEnsureResult } from '@core/plugin/interfaces/plugin-redirect-ensure-result.interface';
import { SystemRedirectService } from '@core/services/system-redirect-service';

/**
 * `context.redirects` — a plugin adds rules to the framework's own redirect store instead of keeping
 * its own table (two plugins once did, and raced each other by boot order).
 *
 * Add-only by design: a plugin cannot change or remove a rule, so it can never take over a path an
 * operator already redirected. The store is tenant-scoped by row-level security on the connection,
 * so a rule lands in the site the plugin is running for, like every other write here.
 */
export class RedirectsContextProxy {
  /** One call may not become an unbounded batch of statements. */
  static readonly MAX_RULES = 500;

  static createRedirectsProxy(
    plugin: ILoadedPlugin,
    manager: IPluginManagerInterface,
    security: ReturnType<typeof ContextSecurityProxy.createSecurityHelpers>,
  ) {
    return {
      async ensure(rules: IPluginRedirectRule[]): Promise<IPluginRedirectEnsureResult> {
        if (!security.hasCapability('content')) security.handleViolation('content');
        const list = Array.isArray(rules) ? rules : [];
        if (list.length > RedirectsContextProxy.MAX_RULES) {
          throw new Error(`context.redirects.ensure takes at most ${RedirectsContextProxy.MAX_RULES} rules per call; got ${list.length}.`);
        }

        const service = new SystemRedirectService(manager.db);
        const result: IPluginRedirectEnsureResult = { created: 0, skipped: 0, failed: [] };
        for (const rule of list) {
          try {
            // The store matches on the path alone, so `/?p=12` would become a rule for `/`. Refuse it
            // rather than write a rule that redirects something other than what was asked.
            if (/[?#]/.test(String(rule?.fromPath ?? ''))) {
              throw new Error('A redirect From path cannot carry a query string or fragment; the store matches on the path alone.');
            }
            const outcome = await service.ensure({
              fromPath: rule?.fromPath,
              toPath: rule?.toPath,
              type: rule?.permanent === false ? '302' : '301',
              enabled: true,
              notes: String(rule?.notes || `Added by plugin "${plugin.manifest.slug}"`),
            });
            if (outcome.created) result.created += 1;
            else result.skipped += 1;
          } catch (error) {
            result.failed.push({ fromPath: String(rule?.fromPath ?? ''), error: (error as Error).message });
          }
        }
        return result;
      },
    };
  }
}
