import { describe, expect, it, vi } from 'vitest';
import { PluginSandboxHostReloadService } from '@core/plugin/services/runtime/plugin-sandbox-host-reload-service';

/**
 * `saveSandboxConfig` used to call `pluginHosts.reload(...)` unconditionally on every save. That was
 * only correct for ONE of the three transitions a save can cause; the other two are what this suite
 * pins down, because they bit us for real:
 *
 *  - isolated -> shared (D2 above): `reload` SIGKILLed the guest via `relaunch()`, replayed
 *    onInit/onEnable and re-emitted `plugins:ready`, then left the plugin isolated anyway.
 *  - shared -> isolated (D3 above): `PluginHostRegistry.reload` returns `false` for a plugin with no
 *    host, so the row was written and nothing else happened — silently, while the admin reported
 *    success.
 *  - a reload that throws (D4 above): the row IS written, but the guest can be left down, and that
 *    must not be reported as a failed save.
 */
describe('PluginSandboxHostReloadService', () => {
  const manifest = { slug: 'sample-widget', sandbox: { memoryLimit: 512, timeout: 5000 } };
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never;

  it('isolated -> isolated: reloads in place, no restart required (the case D3 legitimately fixes)', async () => {
    const reload = vi.fn(async () => true);
    const stop = vi.fn(async () => undefined);
    const hosts = { get: vi.fn(() => ({})), isIsolated: vi.fn(async () => true), reload, stop };

    const result = await new PluginSandboxHostReloadService(hosts, logger).apply('sample-widget', manifest);

    expect(reload).toHaveBeenCalledWith('sample-widget', manifest);
    expect(stop).not.toHaveBeenCalled();
    expect(result).toEqual({ restartRequired: false });
  });

  it('isolated -> shared: stops the host instead of relaunching it, and reports restart required', async () => {
    const reload = vi.fn(async () => true);
    const stop = vi.fn(async () => undefined);
    const hosts = { get: vi.fn(() => ({})), isIsolated: vi.fn(async () => false), reload, stop };
    const scheduleRestart = vi.fn();

    const result = await new PluginSandboxHostReloadService(hosts, logger, () => ({ scheduleRestart } as never)).apply(
      'sample-widget',
      { ...manifest, sandbox: false },
    );

    // The bug: `reload` used to be called unconditionally here, which relaunches (SIGKILL + restart)
    // a process that is about to stop being isolated at all.
    expect(reload).not.toHaveBeenCalled();
    expect(stop).toHaveBeenCalledWith('sample-widget');
    expect(scheduleRestart).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ restartRequired: true });
  });

  it('shared -> isolated: no host to reload, so it schedules a restart instead of silently doing nothing', async () => {
    const reload = vi.fn(async () => true);
    const stop = vi.fn(async () => undefined);
    const hosts = { get: vi.fn(() => null), isIsolated: vi.fn(async () => true), reload, stop };
    const scheduleRestart = vi.fn();

    const result = await new PluginSandboxHostReloadService(hosts, logger, () => ({ scheduleRestart } as never)).apply(
      'sample-widget',
      manifest,
    );

    expect(reload).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
    expect(scheduleRestart).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ restartRequired: true });
  });

  it('reload throws: the save is not reported as failed, but the caller learns the process may be down', async () => {
    const reload = vi.fn(async () => { throw new Error('guest failed to boot: --max-old-space-size=1'); });
    const stop = vi.fn(async () => undefined);
    const hosts = { get: vi.fn(() => ({})), isIsolated: vi.fn(async () => true), reload, stop };

    const result = await new PluginSandboxHostReloadService(hosts, logger).apply('sample-widget', manifest);

    expect(result).toEqual({
      restartRequired: true,
      restartFailed: true,
      reason: 'guest failed to boot: --max-old-space-size=1',
    });
  });

  it('shared -> shared: no host touched, no restart scheduled', async () => {
    const reload = vi.fn(async () => true);
    const stop = vi.fn(async () => undefined);
    const hosts = { get: vi.fn(() => null), isIsolated: vi.fn(async () => false), reload, stop };
    const scheduleRestart = vi.fn();

    const result = await new PluginSandboxHostReloadService(hosts, logger, () => ({ scheduleRestart } as never)).apply(
      'sample-widget',
      { ...manifest, sandbox: false },
    );

    expect(reload).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
    expect(scheduleRestart).not.toHaveBeenCalled();
    expect(result).toEqual({ restartRequired: false });
  });
});
