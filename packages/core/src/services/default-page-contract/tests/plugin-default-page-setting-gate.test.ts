import { beforeEach, describe, expect, it } from 'vitest';
import { CoreServices } from '@core/services/core-services';
import { ServerCoreServices } from '@core/services/server-core-services';
import { PluginDefaultPageMaterializationSiteScope } from '@core/services/default-page-contract/plugin-default-page-materialization-site-scope';
import { PluginDefaultPageContractKind } from '@core/default-page-contract/enums/plugin-default-page-contract-kind.enum';
import { PluginDefaultPageContractMaterializationMode } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-mode.enum';

/**
 * A contract gated by a plugin setting (`enabledBySetting`) materializes only where that setting is
 * stored `true` for the scope; ungated contracts are untouched, and a site that never saved the
 * setting gets no page.
 */
const contract = (key: string, enabledBySetting?: string) => ({
  key,
  capability: 'shop',
  kind: PluginDefaultPageContractKind.FORM_PAGE,
  recipe: `shop.${key}`,
  defaultSlug: `/${key}`,
  materializationMode: PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT,
  required: true,
  adoptionHints: [],
  dependencies: [],
  ...(enabledBySetting ? { enabledBySetting } : {}),
});

const scopeWith = (stored: Record<string, unknown> | null) => new PluginDefaultPageMaterializationSiteScope({
  findOne: async (table: string, where: Record<string, unknown>) => (
    table === '_system_plugin_settings' && where.plugin_slug === 'shop' && stored ? { settings: { settings: stored } } : null
  ),
});

describe('setting-gated default pages', () => {
  beforeEach(() => {
    ServerCoreServices.register();
    CoreServices.reset();
    CoreServices.getInstance().defaultPageContracts.register({
      namespace: 'org.synthetic',
      pluginSlug: 'shop',
      contracts: [contract('store'), contract('withdrawal', 'withdrawalEnabled')] as any,
    });
  });

  const resolved = () => CoreServices.getInstance().defaultPageContractResolution.resolveAll({ overrides: [] });

  it('keeps the gate through registration', () => {
    expect(CoreServices.getInstance().defaultPageContracts.listByPlugin('org.synthetic', 'shop').map((c) => c.enabledBySetting))
      .toEqual([undefined, 'withdrawalEnabled']);
  });

  it('installs the gated page only where the setting is stored true', async () => {
    const keys = async (stored: Record<string, unknown> | null) => (await scopeWith(stored).contractsEnabledBySettings(resolved())).map((c) => c.key);
    expect(await keys({ withdrawalEnabled: true })).toEqual(['store', 'withdrawal']);
    expect(await keys({ withdrawalEnabled: false })).toEqual(['store']);
    expect(await keys({})).toEqual(['store']);
    expect(await keys(null)).toEqual(['store']);
  });
});
