import { afterEach, describe, expect, it } from 'vitest';
import { PluginHostRegistry } from '@core/plugin/host/plugin-host-registry';
import { PluginHost } from '@core/plugin/host/plugin-host';
import { SettingChangeInvalidators } from '@core/settings/setting-change-invalidators';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * Settings → Infrastructure → Plugin Isolation was read once per boot and handed to every host, so a
 * saved deadline or heap ceiling changed nothing — not even for a process started afterwards, which
 * is what the admin promised — until the api restarted.
 */
class IsolationFixture {
  static stored: Record<string, string> = {};

  static registry(): PluginHostRegistry {
    const db = { findOne: async (_table: string, where: { key: string }) => (where.key in IsolationFixture.stored ? { value: IsolationFixture.stored[where.key] } : null) };
    return new PluginHostRegistry({ db } as any, '/tmp');
  }

  /** A host as the registry holds one, without forking a process. */
  static async host(registry: PluginHostRegistry, slug: string, sandbox: unknown = undefined): Promise<{ host: PluginHost; reloads: number[] }> {
    const host = Object.create(PluginHost.prototype) as PluginHost;
    const reloads: number[] = [];
    Object.assign(host, { slug, manifest: { slug, sandbox } });
    const settings = await registry.settingsInEffect();
    Object.assign(host, { settings, limits: settings.forPlugin(sandbox) });
    (host as any).reload = async () => { reloads.push((host as any).limits.memoryMb); };
    (registry as any).hosts.set(slug, host);
    return { host, reloads };
  }

  static save(values: Record<string, string>): Promise<void> {
    Object.assign(IsolationFixture.stored, values);
    SettingChangeInvalidators.dispatch(Object.keys(values).map((key) => ({ key, tenantId: null })));
    // The registry applies asynchronously; let it finish.
    return new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe('saved plugin isolation limits reach running plugins', () => {
  afterEach(() => {
    IsolationFixture.stored = {};
    SettingChangeInvalidators.reset();
  });

  it('a new deadline governs the next call without replacing the process', async () => {
    const registry = IsolationFixture.registry();
    const { host, reloads } = await IsolationFixture.host(registry, 'forms');

    await IsolationFixture.save({ [SystemConstants.META_KEY.PLUGIN_ISOLATION_TIMEOUT_MS]: '45000' });

    expect(host.limitsInEffect.timeoutMs).toBe(45000);
    expect(reloads).toEqual([]);
  });

  it('a new heap ceiling restarts that plugin\'s process on it', async () => {
    const registry = IsolationFixture.registry();
    const { host, reloads } = await IsolationFixture.host(registry, 'forms');

    await IsolationFixture.save({ [SystemConstants.META_KEY.PLUGIN_ISOLATION_MEMORY_MB]: '768' });

    expect(host.limitsInEffect.memoryMb).toBe(768);
    expect(reloads).toEqual([768]);
  });

  it('a plugin whose manifest sets its own limits keeps them and its process', async () => {
    const registry = IsolationFixture.registry();
    const { host, reloads } = await IsolationFixture.host(registry, 'heavy', { memoryLimit: 2048, timeout: 90000 });

    await IsolationFixture.save({
      [SystemConstants.META_KEY.PLUGIN_ISOLATION_MEMORY_MB]: '768',
      [SystemConstants.META_KEY.PLUGIN_ISOLATION_TIMEOUT_MS]: '45000',
    });

    expect(host.limitsInEffect).toEqual({ memoryMb: 2048, timeoutMs: 90000 });
    expect(reloads).toEqual([]);
  });

  it('a process started after the save starts on the saved limits', async () => {
    const registry = IsolationFixture.registry();
    await registry.settingsInEffect();

    await IsolationFixture.save({ [SystemConstants.META_KEY.PLUGIN_ISOLATION_MEMORY_MB]: '1024' });

    expect((await registry.settingsInEffect()).memoryMb).toBe(1024);
  });
});
