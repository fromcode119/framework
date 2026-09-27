import { afterEach, describe, expect, it, vi } from 'vitest';
import { HookManager } from '@core/hooks/hook-manager';
import { PluginHost } from '@core/plugin/host/plugin-host';
import { PluginGuestGeneration } from '@core/plugin/host/generations/plugin-guest-generation';
import { PluginSiteDataReplay } from '@core/plugin/tenant/plugin-site-data-replay';
import { MiddlewareManager } from '@core/plugin/services/runtime/middleware-manager';

/**
 * A relaunched process runs `onInit` with no site bound — the registration pass. Boot follows that with
 * a per-site pass for the plugin's DATA work; a relaunch (hot update, crash restart, new heap ceiling)
 * did not, so after appointments 0.1.53 was installed its awaited staff → People sync read no rows and
 * added nobody, while the warning said the work "still happens".
 */
describe('a relaunch', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  const relaunchWith = async (plugin: unknown) => {
    const replayed: Array<{ plugin: unknown; context: unknown; channel: string }> = [];
    const manager: any = { hooks: new HookManager(), plugins: new Map(plugin ? [['site-data-probe', plugin]] : []), db: {}, middlewares: new MiddlewareManager() };
    const logger: any = { info() {}, warn() {}, error() {}, debug() {} };
    const host = Object.create(PluginHost.prototype) as any;
    const context = { marker: 'the plugin context' };
    vi.spyOn(PluginSiteDataReplay, 'run').mockImplementation(async (p, c) => {
      replayed.push({ plugin: p, context: c, channel: host.channel.label });
      host.context = { marker: 'a per-site view' };
    });
    const oldChannel = { label: 'old', isClosed: false, pendingCount: 0 };
    const next = new PluginGuestGeneration(2, { pid: 2, socketDir: '/tmp/site-data-probe.2', kill() {} } as any, { label: 'next', isClosed: false, pendingCount: 0, close() {}, request: async () => undefined } as any);
    next.described = { contractKeys: [], publicApiKeys: [], manifest: {} };
    Object.assign(host, {
      slug: 'site-data-probe', guest: { pid: 1 }, channel: oldChannel, generation: { channel: oldChannel, retireAfter: async () => undefined },
      context, manager, logger, wasEnabled: false, restarts: 0, healthyTimer: null,
      registrations: { resetForRestart() {}, apply: async () => undefined },
      proxy: { retarget() {}, inFlight: () => 0 }, limits: { timeoutMs: 1000 },
      invoke: async () => undefined,
      launchGeneration: async () => next,
    });
    await host.relaunch();
    return { replayed, host, context };
  };

  it('runs the per-site data pass on the NEW process, with the plugin context, and hands that context back', async () => {
    const plugin = { manifest: { slug: 'site-data-probe' }, onInit: async () => undefined };
    const { replayed, host, context } = await relaunchWith(plugin);

    expect(replayed).toEqual([{ plugin, context, channel: 'next' }]);
    expect(host.context).toBe(context);
  });

  it('has nothing to replay for a plugin the manager no longer holds', async () => {
    const { replayed } = await relaunchWith(undefined);
    expect(replayed).toEqual([]);
  });
});
