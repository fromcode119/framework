import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';

vi.mock('../../security/sandbox-manager', () => ({
  SandboxManager: vi.fn(function SandboxManager() {
    throw new Error('no isolated-vm');
  }),
}));
vi.mock('../../security/integrity-service', () => ({ IntegrityService: { verifyPluginIntegrity: vi.fn().mockResolvedValue(true) } }));
vi.mock('../../security/plugin-signature-service', () => ({ PluginSignatureService: { isEnforced: vi.fn().mockReturnValue(false), verify: vi.fn().mockReturnValue(true) } }));
vi.mock('../../management/manifest', () => ({ ManifestValidator: { validate: vi.fn() } }));
vi.mock('../../security/plugin-permissions-service', () => ({ PluginPermissionsService: { ensure: vi.fn() } }));
vi.mock('uuid', () => ({ v4: vi.fn().mockReturnValue('test-uuid') }));
vi.mock('../../database/seeder', () => ({
  Seeder: vi.fn(class Seeder {
    seed = vi.fn();
  }),
}));
vi.mock('./plugin-failure-isolation-service', () => ({
  PluginFailureIsolationService: vi.fn(class PluginFailureIsolationService {
    rollbackPartialRegistration = vi.fn();
    markPluginError = vi.fn().mockResolvedValue(undefined);
  }),
}));

import { LifecycleService } from './lifecycle-service';
import { CoreServices } from '../../services/core-services';

const makePlugin = (overrides: Record<string, any> = {}) => ({
  manifest: { slug: 'test-plugin', name: 'Test', version: '1.0.0', category: 'general', capabilities: [] },
  ...overrides,
});

const makeManager = () => {
  const plugins = new Map();
  const registeredCollections = new Map();
  const ctx = { collections: { register: vi.fn() } };
  return {
    plugins,
    registeredCollections,
    pluginsRoot: '/plugins',
    db: { findOne: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
    audit: { log: vi.fn() },
    hooks: { on: vi.fn(), emit: vi.fn() },
    apiHost: null,
    integrations: {},
    jobs: {},
    scheduler: {},
    auth: {},
    i18n: {},
    middlewares: { register: vi.fn(), unregisterByPlugin: vi.fn(), clear: vi.fn() },
    headInjections: new Map(),
    schemaManager: {},
    runtime: {},
    emit: vi.fn(),
    getPlugins: vi.fn().mockReturnValue([]),
    enable: vi.fn(),
    disable: vi.fn(),
    delete: vi.fn(),
    getHeadInjections: vi.fn().mockReturnValue([]),
    savePluginConfig: vi.fn(),
    getCollections: vi.fn().mockReturnValue([]),
    getCollection: vi.fn(),
    registerPluginSettings: vi.fn(),
    getPluginSettings: vi.fn(),
    installFromZip: vi.fn(),
    writeLog: vi.fn(),
    disableWithError: vi.fn(),
    installExtensionArchive: vi.fn(),
    getImportMap: vi.fn().mockReturnValue({ imports: {} }),
    getRuntimeModules: vi.fn().mockReturnValue({}),
    getAdminMetadata: vi.fn(),
    updatePlugin: vi.fn(),
    createContext: vi.fn().mockReturnValue(ctx),
    setAuth: vi.fn(),
    setApiHost: vi.fn(),
    _ctx: ctx,
  };
};

const buildService = (savedState: Record<string, any> = {}) => {
  const manager = makeManager();
  const registry = {
    loadInstalledPluginsState: vi.fn().mockResolvedValue(savedState),
    savePluginState: vi.fn().mockResolvedValue(undefined),
    getPluginConfig: vi.fn().mockResolvedValue({}),
    writeLog: vi.fn().mockResolvedValue(undefined),
  };
  const discovery = {
    validateDependencies: vi.fn(),
    checkDependencies: vi.fn().mockReturnValue([]),
    resolveDependencies: vi.fn(),
  };
  const schemaManager = { syncCollection: vi.fn().mockResolvedValue(undefined) };
  const service = new LifecycleService(manager as any, registry as any, discovery as any, schemaManager as any);
  return { service, manager, registry };
};

describe('LifecycleService.register() — install/update hooks', () => {
  it('calls onInstall on first registration (no saved state)', async () => {
    const { service } = buildService({});
    const onInstall = vi.fn().mockResolvedValue(undefined);
    const onInit = vi.fn().mockResolvedValue(undefined);

    await service.register(makePlugin({ onInstall, onInit }));

    expect(onInstall).toHaveBeenCalledOnce();
    expect(onInit).toHaveBeenCalledOnce();
    expect(onInstall.mock.invocationCallOrder[0]).toBeLessThan(onInit.mock.invocationCallOrder[0]);
  });

  it('does not call onInstall on subsequent registrations', async () => {
    const { service } = buildService({ 'test-plugin': { state: 'inactive', version: '1.0.0' } });
    const onInstall = vi.fn().mockResolvedValue(undefined);

    await service.register(makePlugin({ onInstall }));

    expect(onInstall).not.toHaveBeenCalled();
  });

  it('calls onUpdate with old and new version when version changes', async () => {
    const { service } = buildService({ 'test-plugin': { state: 'inactive', version: '1.0.0' } });
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const plugin = makePlugin({
      manifest: { slug: 'test-plugin', name: 'Test', version: '2.0.0', category: 'general', capabilities: [] },
      onUpdate,
    });

    await service.register(plugin);

    expect(onUpdate).toHaveBeenCalledOnce();
    expect(onUpdate).toHaveBeenCalledWith(expect.anything(), { oldVersion: '1.0.0', newVersion: '2.0.0' });
  });

  it('does not call onUpdate when version is unchanged', async () => {
    const { service } = buildService({ 'test-plugin': { state: 'inactive', version: '1.0.0' } });
    const onUpdate = vi.fn().mockResolvedValue(undefined);

    await service.register(makePlugin({ onUpdate }));

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('throws and includes hook name when onInstall fails', async () => {
    const { service } = buildService({});
    const onInstall = vi.fn().mockRejectedValue(new Error('setup failed'));

    await expect(service.register(makePlugin({ onInstall }))).rejects.toThrow('onInstall/onInit');
  });
});

describe('LifecycleService.disable() — middleware cleanup', () => {
  it('calls unregisterByPlugin when disabling', async () => {
    const { service, manager } = buildService({});
    const loadedPlugin = { ...makePlugin(), instanceId: 'x', state: 'active', approvedCapabilities: [], healthStatus: 'healthy' };
    manager.plugins.set('test-plugin', loadedPlugin);

    await service.disable('test-plugin');

    expect(manager.middlewares.unregisterByPlugin).toHaveBeenCalledWith('test-plugin');
    expect(loadedPlugin.state).toBe('inactive');
  });

  it('does nothing when plugin is already inactive', async () => {
    const { service, manager } = buildService({});
    const loadedPlugin = { ...makePlugin(), instanceId: 'x', state: 'inactive', approvedCapabilities: [], healthStatus: 'healthy' };
    manager.plugins.set('test-plugin', loadedPlugin);

    await service.disable('test-plugin');

    expect(manager.middlewares.unregisterByPlugin).not.toHaveBeenCalled();
  });
});

describe('LifecycleService.enable() — required route reconciliation failures', () => {
  it('fails plugin enable when required default-page reconciliation throws', async () => {
    const { service, manager, registry } = buildService({ 'test-plugin': { state: 'inactive', version: '1.0.0' } });
    const loadedPlugin = {
      ...makePlugin(),
      instanceId: 'x',
      state: 'inactive',
      path: '/plugins/test-plugin',
      approvedCapabilities: [],
      healthStatus: 'healthy',
      onEnable: vi.fn().mockResolvedValue(undefined),
    };
    manager.plugins.set('test-plugin', loadedPlugin);
    vi.spyOn((service as any).activation, 'autoDiscoverCollections').mockResolvedValue(undefined);
    vi.spyOn((service as any).activation, 'syncPluginCollections').mockResolvedValue(undefined);
    vi.spyOn((service as any).activation, 'runSeeds').mockResolvedValue(undefined);
    vi.spyOn((service as any).activation, 'materializeDefaultPages').mockRejectedValue(
      new Error('[PluginDefaultPageMaterializationRuntimeService] Required route reconciliation failed: org.synthetic:catalog-module:catalog-index (install-disabled, contract-not-ready)'),
    );

    await expect(service.enable('test-plugin')).rejects.toThrow('Required route reconciliation failed');
    expect(registry.savePluginState).not.toHaveBeenCalledWith('test-plugin', 'active', expect.anything(), expect.anything());
  });

  it('clears stale startup error state after a successful enable', async () => {
    const { service, manager, registry } = buildService({ 'test-plugin': { state: 'error', version: '1.0.0', healthStatus: 'error' } });
    const loadedPlugin = {
      ...makePlugin(),
      instanceId: 'x',
      state: 'error',
      error: 'Invalid or unexpected token',
      path: '/plugins/test-plugin',
      approvedCapabilities: [],
      healthStatus: 'error',
      onEnable: vi.fn().mockResolvedValue(undefined),
    };
    manager.plugins.set('test-plugin', loadedPlugin);
    vi.spyOn((service as any).activation, 'autoDiscoverCollections').mockResolvedValue(undefined);
    vi.spyOn((service as any).activation, 'syncPluginCollections').mockResolvedValue(undefined);
    vi.spyOn((service as any).activation, 'runSeeds').mockResolvedValue(undefined);
    vi.spyOn((service as any).activation, 'materializeDefaultPages').mockResolvedValue(undefined);

    await service.enable('test-plugin');

    expect(loadedPlugin.state).toBe('active');
    expect(loadedPlugin.error).toBeUndefined();
    expect(loadedPlugin.healthStatus).toBe('healthy');
    expect(registry.savePluginState).toHaveBeenCalledWith('test-plugin', 'active', expect.any(Array), '1.0.0');
  });
});

describe('LifecycleService.delete() — uninstall hook and cleanup', () => {
  it('calls onUninstall before removing plugin from map', async () => {
    const { service, manager } = buildService({});
    const onUninstall = vi.fn().mockResolvedValue(undefined);
    const loadedPlugin = { ...makePlugin({ onUninstall }), instanceId: 'x', state: 'inactive', approvedCapabilities: [], healthStatus: 'healthy' };
    manager.plugins.set('test-plugin', loadedPlugin);

    await service.delete('test-plugin');

    expect(onUninstall).toHaveBeenCalledOnce();
    expect(manager.plugins.has('test-plugin')).toBe(false);
  });

  it('removes middleware and collection entries for the deleted plugin', async () => {
    const { service, manager } = buildService({});
    const loadedPlugin = { ...makePlugin(), instanceId: 'x', state: 'inactive', approvedCapabilities: [], healthStatus: 'healthy' };
    manager.plugins.set('test-plugin', loadedPlugin);
    manager.registeredCollections.set('test_plugin_items', { collection: {}, pluginSlug: 'test-plugin' });
    manager.registeredCollections.set('other_plugin_items', { collection: {}, pluginSlug: 'other-plugin' });

    await service.delete('test-plugin');

    expect(manager.middlewares.unregisterByPlugin).toHaveBeenCalledWith('test-plugin');
    expect(manager.registeredCollections.has('test_plugin_items')).toBe(false);
    expect(manager.registeredCollections.has('other_plugin_items')).toBe(true);
  });

  it('completes deletion even when onUninstall throws', async () => {
    const { service, manager } = buildService({});
    const onUninstall = vi.fn().mockRejectedValue(new Error('cleanup failed'));
    const loadedPlugin = { ...makePlugin({ onUninstall }), instanceId: 'x', state: 'inactive', approvedCapabilities: [], healthStatus: 'healthy' };
    manager.plugins.set('test-plugin', loadedPlugin);

    await service.delete('test-plugin');

    expect(manager.plugins.has('test-plugin')).toBe(false);
  });
});

describe('LifecycleService — collections auto-discovery', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('auto-registers valid collection JSON files from collections/ directory', async () => {
    const { service, manager } = buildService({ 'test-plugin': { state: 'active', version: '1.0.0' } });
    const loadedPlugin = {
      ...makePlugin(),
      instanceId: 'x',
      state: 'inactive',
      path: '/plugins/test-plugin',
      approvedCapabilities: [],
      healthStatus: 'healthy',
    };
    manager.plugins.set('test-plugin', loadedPlugin);

    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => String(p).includes('collections'));
    vi.spyOn(fs, 'readdirSync').mockReturnValue(['products.json'] as any);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ slug: 'products', fields: [{ name: 'title', type: 'text' }] }));

    await service.enable('test-plugin');

    expect(manager._ctx.collections.register).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'products', fields: expect.any(Array) })
    );
  });

  it('skips JSON files without a slug or fields array', async () => {
    const { service, manager } = buildService({ 'test-plugin': { state: 'active', version: '1.0.0' } });
    const loadedPlugin = {
      ...makePlugin(),
      instanceId: 'x',
      state: 'inactive',
      path: '/plugins/test-plugin',
      approvedCapabilities: [],
      healthStatus: 'healthy',
    };
    manager.plugins.set('test-plugin', loadedPlugin);

    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => String(p).includes('collections'));
    vi.spyOn(fs, 'readdirSync').mockReturnValue(['bad.json'] as any);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ name: 'No slug or fields' }));

    await service.enable('test-plugin');

    expect(manager._ctx.collections.register).not.toHaveBeenCalled();
  });

  it('skips auto-discovery when plugin has no path', async () => {
    const { service, manager } = buildService({ 'test-plugin': { state: 'active', version: '1.0.0' } });
    const existsSpy = vi.spyOn(fs, 'existsSync');
    const loadedPlugin = {
      ...makePlugin(),
      instanceId: 'x',
      state: 'inactive',
      path: undefined,
      approvedCapabilities: [],
      healthStatus: 'healthy',
    };
    manager.plugins.set('test-plugin', loadedPlugin);

    await service.enable('test-plugin');

    expect(existsSpy).not.toHaveBeenCalled();
  });

  it('materializes default singleton pages after enabling a plugin', async () => {
    CoreServices.reset();
    const { service, manager } = buildService({ 'test-plugin': { state: 'active', version: '1.0.0' } });
    const pages: any[] = [];
    let metaValue = '';
    (manager.db as any).find = vi.fn(async (table: string) => {
      if (table === 'cms_pages') {
        return [...pages];
      }
      return [];
    });
    (manager.db as any).findOne = vi.fn(async (table: string, where: any) => {
      if (table === 'cms_pages') {
        return pages.find((page) => Object.entries(where || {}).every(([key, value]) => page[key] === value)) || null;
      }
      if (table === '_system_meta' && where?.key === 'default_page_contract_associations' && metaValue) {
        return { key: where.key, value: metaValue };
      }
      return null;
    });
    (manager.db as any).insert = vi.fn(async (table: string, data: any) => {
      if (table === 'cms_pages') {
        const record = { id: pages.length + 1, ...data };
        pages.push(record);
        return record;
      }
      if (table === '_system_meta' && data?.key === 'default_page_contract_associations') {
        metaValue = String(data.value || '');
        return data;
      }
      return data;
    });
    (manager.db as any).update = vi.fn(async (table: string, where: any, data: any) => {
      if (table === '_system_meta' && where?.key === 'default_page_contract_associations') {
        metaValue = String(data.value || '');
        return { key: where.key, value: metaValue };
      }
      return data;
    });
    (manager.db as any).count = vi.fn(async () => pages.length);
    manager.registeredCollections.set('cms_pages', {
      pluginSlug: 'cms',
      collection: {
        slug: 'cms_pages',
        shortSlug: 'pages',
        pluginSlug: 'cms',
        workflow: true,
        fields: [
          { name: 'title', type: 'text', localized: true },
          { name: 'slug', type: 'text' },
          { name: 'content', type: 'json', localized: true },
          { name: 'status', type: 'select' },
          { name: 'publishedAt', type: 'datetime' },
          { name: 'customPermalink', type: 'text' },
          { name: 'disablePermalink', type: 'checkbox' },
        ],
      },
    });
    CoreServices.getInstance().defaultPageContracts.register({
      namespace: 'org.synthetic',
      pluginSlug: 'test-plugin',
      contracts: [{
        key: 'landing',
        capability: 'content',
        kind: 'index',
        recipe: 'test.landing',
        defaultSlug: '/landing',
        title: 'Landing',
        materializationMode: 'singleton-document',
        required: true,
        aliases: [],
        adoptionHints: [],
        dependencies: [],
      }],
    });

    const loadedPlugin = {
      ...makePlugin(),
      instanceId: 'x',
      state: 'inactive',
      path: undefined,
      approvedCapabilities: [],
      healthStatus: 'healthy',
    };
    manager.plugins.set('test-plugin', loadedPlugin);

    await service.enable('test-plugin');

    expect(pages).toEqual([
      expect.objectContaining({ slug: 'landing', customPermalink: '/landing', status: 'published', title: 'Landing' }),
    ]);
    expect(JSON.parse(metaValue)).toEqual({
      byCanonicalKey: {
        'org.synthetic:test-plugin:landing': {
          canonicalKey: 'org.synthetic:test-plugin:landing',
          pageId: 1,
        },
      },
      byPageId: {
        '1': {
          canonicalKey: 'org.synthetic:test-plugin:landing',
          pageId: 1,
        },
      },
    });
  });
});
