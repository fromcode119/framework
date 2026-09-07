import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantMode } from '@core/tenant/tenant-mode';
import { PluginTenantAccess } from '@core/plugin/tenant/plugin-tenant-access';
import { RequestContextUtils } from '@core/context/request-context';
import { CoreServices } from '@core/services/core-services';
import { ServerCoreServices } from '@core/services/server-core-services';
import { PluginDefaultPageMaterializationRuntimeService } from '@core/services/default-page-contract/plugin-default-page-materialization-runtime-service';
import { PluginDefaultPageContractMaterializationMode } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-mode.enum';
import { PluginDefaultPageContractKind } from '@core/default-page-contract/enums/plugin-default-page-contract-kind.enum';
import { PluginDefaultPageContractMaterializationStatus } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-status.enum';
import { PluginDefaultPageContractMaterializationExecutionOutcome } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-execution-outcome.enum';
import { PluginDefaultPageContractMaterializationAction } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-action.enum';

const TEST_NAMESPACE = 'org.synthetic';
const TEST_PLUGIN = 'catalog-module';
const TEST_COLLECTION = 'catalog_entries';
const INDEX_CANONICAL_KEY = 'org.synthetic:catalog-module:catalog-index';
const DETAIL_CANONICAL_KEY = 'org.synthetic:catalog-module:catalog-detail';

describe('PluginDefaultPageMaterializationRuntimeService', () => {
  beforeEach(() => {
    // `defaultPageContracts` is a SERVER-only core service: `CoreServices` only looks it up in the
    // registry, so without this the very first getter throws and the assertions below never run.
    ServerCoreServices.register();
    CoreServices.reset();
  });

  it('creates missing singleton pages and persists their associations', async () => {
    const pages: any[] = [];
    let metaValue = '';
    const manager = createManager(pages, () => metaValue, (next) => { metaValue = next; });

    CoreServices.getInstance().defaultPageContracts.register({
      namespace: TEST_NAMESPACE,
      pluginSlug: TEST_PLUGIN,
      contracts: [{
        key: 'catalog-index',
        capability: 'catalog',
        kind: PluginDefaultPageContractKind.INDEX,
        recipe: 'catalog-module.catalog-index',
        defaultSlug: '/catalog',
        title: 'Catalog',
        themeLayout: 'CatalogLayout',
        materializationMode: PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT,
        required: true,
        aliases: ['/browse'],
        adoptionHints: [],
        dependencies: [],
      }],
    });

    const service = new PluginDefaultPageMaterializationRuntimeService(manager as any);
    const report = await service.materialize();

    expect(report?.entries).toEqual([
      expect.objectContaining({
        canonicalKey: INDEX_CANONICAL_KEY,
        executionOutcome: PluginDefaultPageContractMaterializationExecutionOutcome.APPLIED,
        matchedPageId: 1,
      }),
    ]);
    expect(pages).toEqual([
      expect.objectContaining({
        id: 1,
        slug: 'catalog',
        customPermalink: '/catalog',
        recipe: 'catalog-module.catalog-index',
        status: 'published',
        themeLayout: 'CatalogLayout',
        title: 'Catalog',
      }),
    ]);
    expect(JSON.parse(metaValue)).toEqual({
      byCanonicalKey: {
        [INDEX_CANONICAL_KEY]: {
          canonicalKey: INDEX_CANONICAL_KEY,
          pageId: 1,
        },
      },
      byPageId: {
        '1': {
          canonicalKey: INDEX_CANONICAL_KEY,
          pageId: 1,
        },
      },
    });
  });

  it('reconciles recipe metadata onto adopted singleton pages during startup materialization', async () => {
    const pages: any[] = [{ id: 1, slug: 'catalog', customPermalink: '/catalog', title: 'Catalog', status: 'published' }];
    let metaValue = '';
    const manager = createManager(pages, () => metaValue, (next) => { metaValue = next; });

    CoreServices.getInstance().defaultPageContracts.register({
      namespace: TEST_NAMESPACE,
      pluginSlug: TEST_PLUGIN,
      contracts: [{
        key: 'catalog-index',
        capability: 'catalog',
        kind: PluginDefaultPageContractKind.INDEX,
        recipe: 'catalog-module.catalog-index',
        defaultSlug: '/catalog',
        title: 'Catalog',
        themeLayout: 'CatalogLayout',
        materializationMode: PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT,
        required: true,
        aliases: ['/browse'],
        adoptionHints: [],
        dependencies: [],
      }],
    });

    const service = new PluginDefaultPageMaterializationRuntimeService(manager as any);
    const report = await service.materialize();

    expect(report?.entries).toEqual([
      expect.objectContaining({
        canonicalKey: INDEX_CANONICAL_KEY,
        executionOutcome: PluginDefaultPageContractMaterializationExecutionOutcome.APPLIED,
        matchedPageId: 1,
      }),
    ]);
    expect(pages).toEqual([
      expect.objectContaining({
        id: 1,
        customPermalink: '/catalog',
        recipe: 'catalog-module.catalog-index',
        themeLayout: 'CatalogLayout',
      }),
    ]);
  });

  it('does not create or associate literal placeholder pages for parameterized detail contracts', async () => {
    const pages: any[] = [{ id: 9, slug: 'catalog-item', customPermalink: '/catalog/:slug', title: 'Placeholder', status: 'published' }];
    let metaValue = JSON.stringify({
      byCanonicalKey: {
        [DETAIL_CANONICAL_KEY]: {
          canonicalKey: DETAIL_CANONICAL_KEY,
          pageId: 9,
        },
      },
      byPageId: {
        '9': {
          canonicalKey: DETAIL_CANONICAL_KEY,
          pageId: 9,
        },
      },
    });
    const manager = createManager(pages, () => metaValue, (next) => { metaValue = next; });

    CoreServices.getInstance().defaultPageContracts.register({
      namespace: TEST_NAMESPACE,
      pluginSlug: TEST_PLUGIN,
      contracts: [{
        key: 'catalog-detail',
        capability: 'catalog',
        kind: PluginDefaultPageContractKind.DETAIL,
        recipe: 'catalog-module.catalog-detail',
        recordCollection: TEST_COLLECTION,
        defaultSlug: '/catalog/:slug',
        title: 'Catalog Detail',
        themeLayout: 'CatalogLayout',
        materializationMode: PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT,
        required: true,
        aliases: [],
        adoptionHints: ['/catalog/:slug'],
        dependencies: [],
      }],
    });

    const service = new PluginDefaultPageMaterializationRuntimeService(manager as any);
    const report = await service.materialize();

    expect(report?.entries).toEqual([
      expect.objectContaining({
        canonicalKey: DETAIL_CANONICAL_KEY,
        action: PluginDefaultPageContractMaterializationAction.DEFERRED,
        status: PluginDefaultPageContractMaterializationStatus.DEFERRED,
        executionOutcome: PluginDefaultPageContractMaterializationExecutionOutcome.SKIPPED,
        matchedPageId: undefined,
        reasons: ['parameterized-route-deferred'],
      }),
    ]);
    expect(pages).toEqual([
      expect.objectContaining({
        id: 9,
        customPermalink: '/catalog/:slug',
        title: 'Placeholder',
      }),
    ]);
    expect(JSON.parse(metaValue)).toEqual({
      byCanonicalKey: {
        [DETAIL_CANONICAL_KEY]: {
          canonicalKey: DETAIL_CANONICAL_KEY,
          pageId: 9,
        },
      },
      byPageId: {
        '9': {
          canonicalKey: DETAIL_CANONICAL_KEY,
          pageId: 9,
        },
      },
    });
  });

  it('throws when a required singleton route is not ready for reconciliation', async () => {
    const pages: any[] = [];
    let metaValue = '';
    const manager = createManager(pages, () => metaValue, (next) => { metaValue = next; });

    const service = new PluginDefaultPageMaterializationRuntimeService(
      manager as any,
      async () => [{
        contract: {
          namespace: TEST_NAMESPACE,
          pluginSlug: TEST_PLUGIN,
          key: 'catalog-index',
        },
        install: false,
      }],
    );

    CoreServices.getInstance().defaultPageContracts.register({
      namespace: TEST_NAMESPACE,
      pluginSlug: TEST_PLUGIN,
      contracts: [{
        key: 'catalog-index',
        capability: 'catalog',
        kind: PluginDefaultPageContractKind.INDEX,
        recipe: 'catalog-module.catalog-index',
        defaultSlug: '/catalog',
        title: 'Catalog',
        themeLayout: 'CatalogLayout',
        materializationMode: PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT,
        required: true,
        aliases: [],
        adoptionHints: [],
        dependencies: [],
      }],
    });

    await expect(service.materialize()).rejects.toThrow(
      'Required route reconciliation failed: org.synthetic:catalog-module:catalog-index (install-disabled, contract-not-ready)',
    );
  });

  it('re-associates a contract whose associated page no longer exists', async () => {
    const pages: any[] = [{ id: 7, slug: 'catalog', customPermalink: '/catalog', title: 'Catalog', status: 'published' }];
    let metaValue = JSON.stringify({
      byCanonicalKey: { [INDEX_CANONICAL_KEY]: { canonicalKey: INDEX_CANONICAL_KEY, pageId: 99 } },
      byPageId: { '99': { canonicalKey: INDEX_CANONICAL_KEY, pageId: 99 } },
    });
    const manager = createManager(pages, () => metaValue, (next) => { metaValue = next; });

    registerCatalogIndexContract();

    const service = new PluginDefaultPageMaterializationRuntimeService(manager as any);
    const report = await service.materialize();

    expect(report?.entries).toEqual([
      expect.objectContaining({
        canonicalKey: INDEX_CANONICAL_KEY,
        executionOutcome: PluginDefaultPageContractMaterializationExecutionOutcome.APPLIED,
        matchedPageId: 7,
      }),
    ]);
    expect(pages).toHaveLength(1);
    expect(JSON.parse(metaValue)).toEqual({
      byCanonicalKey: { [INDEX_CANONICAL_KEY]: { canonicalKey: INDEX_CANONICAL_KEY, pageId: 7 } },
      byPageId: { '7': { canonicalKey: INDEX_CANONICAL_KEY, pageId: 7 } },
    });
  });

  it('drops a one-sided page association left behind by a deleted page', async () => {
    const pages: any[] = [{ id: 7, slug: 'catalog', customPermalink: '/catalog', title: 'Catalog', status: 'published' }];
    let metaValue = JSON.stringify({
      byCanonicalKey: {},
      byPageId: { '99': { canonicalKey: INDEX_CANONICAL_KEY, pageId: 99 } },
    });
    const manager = createManager(pages, () => metaValue, (next) => { metaValue = next; });

    registerCatalogIndexContract();

    const service = new PluginDefaultPageMaterializationRuntimeService(manager as any);
    const report = await service.materialize();

    expect(report?.entries).toEqual([
      expect.objectContaining({
        canonicalKey: INDEX_CANONICAL_KEY,
        executionOutcome: PluginDefaultPageContractMaterializationExecutionOutcome.APPLIED,
        matchedPageId: 7,
      }),
    ]);
    expect(JSON.parse(metaValue).byPageId).toEqual({
      '7': { canonicalKey: INDEX_CANONICAL_KEY, pageId: 7 },
    });
  });

  it('does not fail one plugin for another plugin s broken required route', async () => {
    const pages: any[] = [];
    let metaValue = '';
    const manager = createManager(pages, () => metaValue, (next) => { metaValue = next; });

    const service = new PluginDefaultPageMaterializationRuntimeService(
      manager as any,
      async () => [{
        contract: { namespace: TEST_NAMESPACE, pluginSlug: TEST_PLUGIN, key: 'catalog-index' },
        install: false,
      }],
    );

    registerCatalogIndexContract();

    await expect(service.materialize('unrelated-plugin')).resolves.not.toBeNull();
    await expect(service.materialize(TEST_PLUGIN)).rejects.toThrow(
      'Required route reconciliation failed: org.synthetic:catalog-module:catalog-index (install-disabled, contract-not-ready)',
    );
  });

  it('does not throw when the pages collection is unavailable during runtime materialization', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const manager = createManagerWithoutPagesCollection(() => '', () => undefined);

    CoreServices.getInstance().defaultPageContracts.register({
      namespace: TEST_NAMESPACE,
      pluginSlug: TEST_PLUGIN,
      contracts: [{
        key: 'catalog-index',
        capability: 'catalog',
        kind: PluginDefaultPageContractKind.INDEX,
        recipe: 'catalog-module.catalog-index',
        defaultSlug: '/catalog',
        title: 'Catalog',
        themeLayout: 'CatalogLayout',
        materializationMode: PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT,
        required: true,
        aliases: [],
        adoptionHints: [],
        dependencies: [],
      }],
    });

    const service = new PluginDefaultPageMaterializationRuntimeService(manager as any);

    await expect(service.materialize()).resolves.toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      '[PluginDefaultPageMaterializationRuntimeService] Skipping default page materialization because no registered page collection is available.',
    );

    warnSpy.mockRestore();
  });
});

function registerCatalogIndexContract(): void {
  CoreServices.getInstance().defaultPageContracts.register({
    namespace: TEST_NAMESPACE,
    pluginSlug: TEST_PLUGIN,
    contracts: [{
      key: 'catalog-index',
      capability: 'catalog',
      kind: PluginDefaultPageContractKind.INDEX,
      recipe: 'catalog-module.catalog-index',
      defaultSlug: '/catalog',
      title: 'Catalog',
      themeLayout: 'CatalogLayout',
      materializationMode: PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT,
      required: true,
      aliases: [],
      adoptionHints: [],
      dependencies: [],
    }],
  });
}

function createManager(pages: any[], getMetaValue: () => string, setMetaValue: (value: string) => void) {
  return {
    registeredCollections: new Map([
      ['alpha_pages', {
        pluginSlug: 'alpha',
        collection: {
          slug: 'alpha_pages',
          shortSlug: 'pages', storefrontPages: true,
          pluginSlug: 'alpha',
          workflow: true,
          fields: [
            { name: 'title', type: 'text', localized: true },
            { name: 'slug', type: 'text' },
            { name: 'content', type: 'json', localized: true },
            { name: 'status', type: 'select' },
            { name: 'publishedAt', type: 'datetime' },
            { name: 'customPermalink', type: 'text' },
            { name: 'disablePermalink', type: 'checkbox' },
            { name: 'recipe', type: 'text' },
            { name: 'themeLayout', type: 'text' },
          ],
        },
      }],
      ['catalog', {
        pluginSlug: TEST_PLUGIN,
        collection: {
          slug: TEST_COLLECTION,
          shortSlug: TEST_COLLECTION,
          pluginSlug: TEST_PLUGIN,
          fields: [
            { name: 'slug', type: 'text' },
            { name: 'disablePermalink', type: 'checkbox' },
          ],
        },
      }],
    ]),
    db: {
      find: vi.fn(async (table: string) => {
        if (table === 'alpha_pages') {
          return [...pages];
        }

        if (table === TEST_COLLECTION) {
          return [];
        }

        return [];
      }),
      findOne: vi.fn(async (table: string, where: any) => {
        if (table === 'alpha_pages') {
          return pages.find((page) => Object.entries(where || {}).every(([key, value]) => page[key] === value)) || null;
        }
        if (table === TEST_COLLECTION) {
          return null;
        }
        if (table === '_system_meta' && where?.key === 'default_page_contract_associations' && getMetaValue()) {
          return { key: where.key, value: getMetaValue() };
        }

        return null;
      }),
      insert: vi.fn(async (table: string, data: any) => {
        if (table === 'alpha_pages') {
          const record = { id: pages.length + 1, ...data };
          pages.push(record);
          return record;
        }
        if (table === '_system_meta' && data?.key === 'default_page_contract_associations') {
          setMetaValue(String(data.value || ''));
          return data;
        }

        return data;
      }),
      update: vi.fn(async (table: string, where: any, data: any) => {
        if (table === 'alpha_pages') {
          const record = pages.find((page) => Object.entries(where || {}).every(([key, value]) => page[key] === value));
          if (!record) {
            return null;
          }
          Object.assign(record, data);
          return record;
        }
        if (table === '_system_meta' && where?.key === 'default_page_contract_associations') {
          setMetaValue(String(data.value || ''));
          return { key: where.key, value: getMetaValue() };
        }

        return null;
      }),
      delete: vi.fn(),
      count: vi.fn(async () => pages.length),
    },
  };
}

function createManagerWithoutPagesCollection(getMetaValue: () => string, setMetaValue: (value: string) => void) {
  return {
    registeredCollections: new Map(),
    db: {
      findOne: vi.fn(async (table: string, where: Record<string, unknown>) => {
        if (table === '_system_meta' && where?.key === 'default_page_contract_associations') {
          const value = getMetaValue();
          return value ? { key: 'default_page_contract_associations', value } : null;
        }
        return null;
      }),
      insert: vi.fn(async (_table: string, data: Record<string, unknown>) => {
        if (data?.key === 'default_page_contract_associations') {
          setMetaValue(String(data.value || ''));
        }
        return data;
      }),
      update: vi.fn(async (_table: string, where: Record<string, unknown>, data: Record<string, unknown>) => {
        if (where?.key === 'default_page_contract_associations') {
          setMetaValue(String(data.value || ''));
        }
        return data;
      }),
      find: vi.fn(async () => []),
      delete: vi.fn(async () => true),
      count: vi.fn(async () => 0),
    },
  };
}
describe('PluginDefaultPageMaterializationRuntimeService inside a site', () => {
  const contract = (pluginSlug: string, key: string, slug: string) => ({
    namespace: TEST_NAMESPACE,
    pluginSlug,
    contracts: [{
      key, capability: key, kind: PluginDefaultPageContractKind.INDEX, recipe: `${pluginSlug}.${key}`, defaultSlug: slug, title: key,
      themeLayout: 'Layout', materializationMode: PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT,
      required: true, aliases: [], adoptionHints: [], dependencies: [],
    }],
  });

  beforeEach(() => {
    ServerCoreServices.register();
    CoreServices.reset();
    TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });
    PluginTenantAccess.configure({ find: async () => [{ tenant_id: 't1', plugin_slug: 'shop-plugin', state: 'active' }] });
  });

  afterEach(() => { TenantMode.reset(); PluginTenantAccess.reset(); });

  it('materializes only the contracts of plugins the site runs', async () => {
    const pages: any[] = [];
    let metaValue = '';
    const manager = createManager(pages, () => metaValue, (next) => { metaValue = next; });
    CoreServices.getInstance().defaultPageContracts.register(contract('shop-plugin', 'shop-index', '/shop'));
    CoreServices.getInstance().defaultPageContracts.register(contract('stars-plugin', 'stars-index', '/stars'));
    await PluginTenantAccess.warm('t1');

    await RequestContextUtils.storage.run({ locale: '', tenantId: 't1' }, () =>
      new PluginDefaultPageMaterializationRuntimeService(manager as any).materialize());

    expect(pages.map((page) => page.customPermalink)).toEqual(['/shop']);
  });

  it('outside a site (the single-site boot pass) every contract still applies', async () => {
    TenantMode.reset();
    const pages: any[] = [];
    let metaValue = '';
    const manager = createManager(pages, () => metaValue, (next) => { metaValue = next; });
    CoreServices.getInstance().defaultPageContracts.register(contract('shop-plugin', 'shop-index', '/shop'));
    CoreServices.getInstance().defaultPageContracts.register(contract('stars-plugin', 'stars-index', '/stars'));
    await new PluginDefaultPageMaterializationRuntimeService(manager as any).materialize();
    expect(pages.map((page) => page.customPermalink).sort()).toEqual(['/shop', '/stars']);
  });
});
