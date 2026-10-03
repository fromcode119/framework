import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';

vi.mock('@core/security/integrity-service', () => ({ IntegrityService: { verifyPluginIntegrity: vi.fn().mockResolvedValue(true) } }));
vi.mock('@core/security/plugin-signature-service', () => ({ PluginSignatureService: { isEnforced: vi.fn().mockReturnValue(false), verify: vi.fn().mockReturnValue(true) } }));
vi.mock('@core/management/manifest-validator', () => ({ ManifestValidator: { validate: vi.fn() } }));
vi.mock('@core/security/plugin-permissions-service', () => ({ PluginPermissionsService: { ensure: vi.fn() } }));
vi.mock('uuid', () => ({ v4: vi.fn().mockReturnValue('test-uuid') }));
vi.mock('@core/database/seeder', () => ({
  Seeder: vi.fn(class Seeder {
    seed = vi.fn();
  }),
}));
vi.mock('@core/plugin/services/runtime/plugin-failure-isolation-service', () => ({
  PluginFailureIsolationService: vi.fn(class PluginFailureIsolationService {
    rollbackPartialRegistration = vi.fn();
    markPluginError = vi.fn().mockResolvedValue(undefined);
  }),
}));

import { LifecycleService } from '@core/plugin/services/runtime/lifecycle-service';
import { CoreServices } from '@core/services/core-services';
import { ServerCoreServices } from '@core/services/server-core-services';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { PluginRegistryHealth } from '@core/plugin/services/enums/plugin-registry-health.enum';
import { PluginHeldReason } from '@core/plugin/services/enums/plugin-held-reason.enum';

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
    markPluginHeld: vi.fn().mockResolvedValue(undefined),
    clearPluginHeld: vi.fn().mockResolvedValue(undefined),
    getPluginConfig: vi.fn().mockResolvedValue({}),
    writeLog: vi.fn().mockResolvedValue(undefined),
    // The registry row is created BEFORE the lifecycle hooks run, so a plugin that registers a
    // scheduled task or writes settings from onInit has the row its foreign key points at.
    // `true` = this call created it, which is what makes the failure path undo it.
    ensurePluginRegistryRow: vi.fn().mockResolvedValue(true),
    removePluginRegistryRow: vi.fn().mockResolvedValue(undefined),
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


import { PluginConsentRequiredError } from '@core/plugin/consent/plugin-consent-required-error';

const SHOP = { slug: 'shop', name: 'Shop', version: '2.0.0', category: 'general', capabilities: ['hooks', 'network'], network: { hosts: ['api.payments.example'] } };
const SHOP_CONSENT = ['hooks', 'network', 'network:host:api.payments.example'];

describe('nothing of a plugin runs before it is approved', () => {
  it('a NEW plugin that asks for anything registers without running a single hook, and is held awaiting approval', async () => {
    const { service, manager, registry } = buildService({});
    const onInstall = vi.fn(); const onInit = vi.fn();

    await service.register({ manifest: { ...SHOP }, onInstall, onInit } as any);

    expect(onInstall).not.toHaveBeenCalled();
    expect(onInit).not.toHaveBeenCalled();
    const loaded = manager.plugins.get('shop');
    expect(loaded.heldReason).toBe(PluginHeldReason.AWAITING_APPROVAL);
    expect(loaded.registrationDeferred).toEqual({ isFreshInstall: true, savedVersion: undefined });
    expect(registry.markPluginHeld).toHaveBeenCalledWith('shop', PluginHeldReason.AWAITING_APPROVAL);
  });

  it('enabling it without the approval list is refused with the summary the dialog shows', async () => {
    const { service } = buildService({});
    await service.register({ manifest: { ...SHOP } } as any);

    const refusal = await service.enable('shop').catch((error) => error);

    expect(PluginConsentRequiredError.is(refusal)).toBe(true);
    expect(refusal.summary.consent).toEqual(SHOP_CONSENT);
    expect(refusal.summary.entries.find((entry: any) => entry.host === 'api.payments.example')?.isNew).toBe(true);
  });

  it('refuses a list that differs from what the plugin asks for now', async () => {
    const { service } = buildService({});
    await service.register({ manifest: { ...SHOP } } as any);

    await expect(service.enable('shop', { approve: ['hooks', 'network'] })).rejects.toThrow(/needs approval/);
  });

  it('with the exact list it records the approval, runs the deferred hooks, then activates', async () => {
    const { service, manager, registry } = buildService({});
    const onInstall = vi.fn(); const onInit = vi.fn(); const onEnable = vi.fn();
    await service.register({ manifest: { ...SHOP }, onInstall, onInit, onEnable } as any);

    await service.enable('shop', { approve: [...SHOP_CONSENT].reverse() });

    const loaded = manager.plugins.get('shop');
    expect(onInstall).toHaveBeenCalledOnce();
    expect(onInit).toHaveBeenCalledOnce();
    expect(onEnable).toHaveBeenCalledOnce();
    expect(loaded.state).toBe(PluginState.ACTIVE);
    expect(loaded.approvedCapabilities).toEqual(SHOP_CONSENT);
    expect(loaded.registrationDeferred).toBeUndefined();
    expect(registry.savePluginState).toHaveBeenLastCalledWith('shop', PluginState.ACTIVE, SHOP_CONSENT, '2.0.0');
  });

  it('an ACTIVE plugin whose new version reaches a host nobody approved is held at boot', async () => {
    const saved = { shop: { state: PluginState.ACTIVE, version: '1.0.0', approvedCapabilities: ['hooks', 'network', 'network:host:api.payments.example'] } };
    const { service, manager, registry } = buildService(saved);
    const onInit = vi.fn();

    await service.register({ manifest: { ...SHOP, network: { hosts: ['api.payments.example', 'collect.elsewhere.example'] } }, onInit } as any);

    expect(onInit).not.toHaveBeenCalled();
    expect(manager.plugins.get('shop').heldReason).toBe(PluginHeldReason.CAPABILITY_DRIFT);
    expect(registry.markPluginHeld).toHaveBeenCalledWith('shop', PluginHeldReason.CAPABILITY_DRIFT);
  });

  it('an approval made before hosts were part of it carries over to the declared hosts once, and keeps running', async () => {
    const saved = { shop: { state: PluginState.ACTIVE, version: '2.0.0', approvedCapabilities: ['hooks', 'network'] } };
    const { service, manager } = buildService(saved);
    const onInit = vi.fn();

    await service.register({ manifest: { ...SHOP }, onInit } as any);

    expect(onInit).toHaveBeenCalledOnce();
    expect(manager.plugins.get('shop').approvedCapabilities).toEqual(SHOP_CONSENT);
    expect(manager.plugins.get('shop').heldReason).toBeUndefined();
    expect(manager.db.update).toHaveBeenCalledWith('_system_plugins', { slug: 'shop' }, expect.objectContaining({ capabilities: JSON.stringify(SHOP_CONSENT) }));
  });

  it('a version that asks for LESS keeps running, and its approval shrinks with it', async () => {
    const saved = { shop: { state: PluginState.ACTIVE, version: '1.0.0', approvedCapabilities: [...SHOP_CONSENT, 'email'] } };
    const { service, manager, registry } = buildService(saved);

    await service.register({ manifest: { ...SHOP } } as any);

    expect(manager.plugins.get('shop').heldReason).toBeUndefined();
    expect(registry.savePluginState).toHaveBeenCalledWith('shop', PluginState.ACTIVE, SHOP_CONSENT, '2.0.0');
  });
});
