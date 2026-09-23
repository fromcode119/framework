import { describe, expect, it, vi } from 'vitest';
import {
  PluginDefaultPageContractMaterializationMode,
  PluginDefaultPageContractResolutionStatus,
} from '@fromcode119/core';
import { PageDesignLookupService } from '@api/services/helpers/page-design-lookup-service';

const pagesCollection = { slug: 'pages', shortSlug: 'pages', storefrontPages: true, fields: [] };
const contract = {
  install: true,
  status: PluginDefaultPageContractResolutionStatus.READY,
  materializationMode: PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT,
  effectiveSlug: '/policy',
  effectiveAliases: [],
  effectiveRecipe: 'policy-module.policy-page',
  effectiveTitle: 'Policy',
  pluginSlug: 'policy-module',
} as any;

function subject(doc: Record<string, unknown> | null) {
  const manager: any = {
    registeredCollections: new Map([['pages', { pluginSlug: 'content-module', collection: pagesCollection }]]),
    getPlugins: () => [{ manifest: { slug: 'policy-module', name: 'Policy Module' } }],
  };
  const restController: any = { find: vi.fn(async () => ({ docs: doc ? [doc] : [] })) };
  return { service: new PageDesignLookupService(manager, restController), restController };
}

describe('PageDesignLookupService', () => {
  it('names the plugin whose design fills the page, by the same path match the storefront uses', async () => {
    const { service, restController } = subject({ id: 5, slug: 'policy', customPermalink: '/policy' });
    const user = { id: 1 };
    await expect(service.find('pages', '5', user, async () => [contract])).resolves.toEqual({
      pluginSlug: 'policy-module', pluginName: 'Policy Module', title: 'Policy',
    });
    // Read with the caller's identity: someone who cannot open the page learns nothing here either.
    expect(restController.find.mock.calls[0][1]).toMatchObject({ query: { id: '5', limit: 1 }, user });
  });

  it('matches a page with no custom permalink by its slug', async () => {
    const { service } = subject({ id: 5, slug: 'policy' });
    await expect(service.find('pages', '5', null, async () => [contract])).resolves.toMatchObject({ pluginSlug: 'policy-module' });
  });

  it('answers null for an ordinary page, another collection, or a record the caller cannot read', async () => {
    expect(await subject({ id: 6, slug: 'about' }).service.find('pages', '6', null, async () => [contract])).toBeNull();
    expect(await subject({ id: 5, slug: 'policy' }).service.find('posts', '5', null, async () => [contract])).toBeNull();
    expect(await subject(null).service.find('pages', '5', null, async () => [contract])).toBeNull();
  });

  it('answers null when this site does not run the plugin (its contract is not in the site list)', async () => {
    expect(await subject({ id: 5, slug: 'policy' }).service.find('pages', '5', null, async () => [])).toBeNull();
  });
});
