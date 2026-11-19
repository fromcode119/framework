import { describe, expect, it, vi } from 'vitest';
import { LifecycleService } from '@core/plugin/services/runtime/lifecycle-service';
import { PluginManagerApi } from '@core/plugin/plugin-manager-api';
import { PluginDiscoveryCoordinatorService } from '@core/plugin/services/installation/plugin-discovery-coordinator-service';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';

/**
 * A plugin whose code failed to load is kept as a bare manifest in state ERROR. During a rolling core
 * update its isolated host was still the old one, so the load failed; the operator then pressed
 * "enable". Enabling the bare manifest ran no onEnable, found no collections, and marked it ACTIVE —
 * so the admin answered "collection not found" for every screen, and every later rescan skipped it as
 * already running. Only an api restart brought it back.
 */
describe('enabling a plugin whose code never loaded', () => {
  const placeholder = () => ({
    manifest: { slug: 'shop', version: '1.0.0' },
    path: '/plugins/shop',
    state: PluginState.ERROR,
    error: "Cannot read properties of undefined (reading 'object')",
    loadFailed: true,
    instanceId: 'err-shop-1',
  });

  it('LifecycleService refuses it with the load error and never marks it ACTIVE', async () => {
    const plugin: any = placeholder();
    const manager: any = { plugins: new Map([['shop', plugin]]), db: {} };
    const svc = new LifecycleService(manager, {} as never, { checkDependencies: () => [] } as never, {} as never, () => '1.0.0');

    await expect(svc.enable('shop')).rejects.toThrow(/could not be loaded: Cannot read properties/);
    expect(plugin.state).toBe(PluginState.ERROR);
  });

  it('the manager loads it again first, and does not enable twice when the rescan activated it', async () => {
    const manager: any = Object.create(PluginManagerApi.prototype);
    manager.plugins = new Map([['shop', placeholder()]]);
    manager.lifecycle = { enable: vi.fn() };
    manager.discoverPlugins = vi.fn(async () => {
      manager.plugins.set('shop', { manifest: { slug: 'shop', version: '1.0.0' }, state: PluginState.ACTIVE, instanceId: 'real' });
    });

    await manager.enable('shop');

    expect(manager.discoverPlugins).toHaveBeenCalledTimes(1);
    expect(manager.lifecycle.enable).not.toHaveBeenCalled();
  });

  it('a plugin the rescan loaded but left inactive is then enabled normally', async () => {
    const manager: any = Object.create(PluginManagerApi.prototype);
    manager.plugins = new Map([['shop', placeholder()]]);
    manager.lifecycle = { enable: vi.fn() };
    manager.discoverPlugins = vi.fn(async () => {
      manager.plugins.set('shop', { manifest: { slug: 'shop', version: '1.0.0' }, state: PluginState.INACTIVE, instanceId: 'real' });
    });

    await manager.enable('shop', { force: true });

    expect(manager.lifecycle.enable).toHaveBeenCalledWith('shop', { force: true });
  });

  it('a loaded plugin is enabled without a rescan', async () => {
    const manager: any = Object.create(PluginManagerApi.prototype);
    manager.plugins = new Map([['shop', { manifest: { slug: 'shop' }, state: PluginState.INACTIVE }]]);
    manager.lifecycle = { enable: vi.fn() };
    manager.discoverPlugins = vi.fn();

    await manager.enable('shop');

    expect(manager.discoverPlugins).not.toHaveBeenCalled();
    expect(manager.lifecycle.enable).toHaveBeenCalledTimes(1);
  });

  it('the discovery pass marks a plugin whose module failed to load as loadFailed', async () => {
    const plugins = new Map<string, any>();
    const discovery: any = {
      discoverPlugins: async () => ({ discovered: [], errored: [{ manifest: { slug: 'shop' }, path: '/plugins/shop', error: 'boom' }] }),
      resolveDependencies: () => [],
    };
    const coordinator = new PluginDiscoveryCoordinatorService(
      { warn: vi.fn(), error: vi.fn() } as never,
      plugins,
      { loadInstalledPluginsState: async () => ({}) } as never,
      discovery,
      { coordinate: async () => undefined } as never,
      { materializeDefaultPagesFinalPass: async () => undefined, reportBootPluginHealth: async () => undefined } as never,
      { adopt: async () => undefined } as never,
    );

    await coordinator.discoverPlugins();

    expect(plugins.get('shop')).toMatchObject({ state: PluginState.ERROR, loadFailed: true, error: 'boom' });
  });
});
