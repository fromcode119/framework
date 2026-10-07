import type { IPluginRedirectRule } from '@core/plugin/interfaces/plugin-redirect-rule.interface';
import type { IPluginRedirectEnsureResult } from '@core/plugin/interfaces/plugin-redirect-ensure-result.interface';

/**
 * The `context.redirects` surface of {@link PluginContext}: add rules to the site's own redirect store
 * (Settings → Redirects), the one every would-be-404 is checked against.
 */
export interface IPluginContextRedirects {
  /**
   * Add each rule whose `fromPath` has no rule yet; a path that already has one is SKIPPED, never
   * overwritten — an operator's edit always wins, and running the same import twice adds nothing.
   * At most 500 rules per call. Needs the `content` capability.
   */
  ensure(rules: IPluginRedirectRule[]): Promise<IPluginRedirectEnsureResult>;
}
