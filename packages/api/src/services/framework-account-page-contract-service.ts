import { CoreServices, AccountRouteUtils } from '@fromcode119/core';
import { PluginDefaultPageContractKind } from '@fromcode119/core';
import { PluginDefaultPageContractMaterializationMode } from '@fromcode119/core';
import { PluginDefaultPageContractDependency } from '@fromcode119/core';

/**
 * Registers the account page routes at the framework level (namespace/slug `system`), so `/account`
 * and every `/account/:section` resolve to the built-in AccountShell — no `account` plugin required.
 * The resolution shell-match treats `system`-owned contracts as always-active.
 */
export class FrameworkAccountPageContractService {
  static register(): void {
    try {
      CoreServices.getInstance().defaultPageContracts.register({
        namespace: 'system',
        pluginSlug: 'system',
        contracts: [
          {
            key: 'account-index',
            kind: PluginDefaultPageContractKind.INDEX,
            defaultSlug: AccountRouteUtils.base(),
            capability: 'frontend',
            recipe: 'account.shell',
            materializationMode: PluginDefaultPageContractMaterializationMode.ADOPT_ONLY,
            dependencies: [PluginDefaultPageContractDependency.SETTINGS],
            adoptionHints: [AccountRouteUtils.base(), AccountRouteUtils.base().replace(/^\//, '')],
            required: true,
          },
          {
            key: 'account-section',
            kind: PluginDefaultPageContractKind.DETAIL,
            defaultSlug: AccountRouteUtils.sectionPattern(),
            capability: 'frontend',
            recipe: 'account.shell',
            materializationMode: PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT,
            dependencies: [PluginDefaultPageContractDependency.SETTINGS],
            adoptionHints: [AccountRouteUtils.sectionPattern()],
            required: true,
          },
        ],
      });
    } catch {
      // non-fatal: account sub-paths simply fall back to the index page
    }
  }
}
