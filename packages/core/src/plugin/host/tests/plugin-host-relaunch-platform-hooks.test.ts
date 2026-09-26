import { describe, expect, it } from 'vitest';
import { HookManager } from '@core/hooks/hook-manager';
import { PluginContextFactory } from '@core/plugin/context';
import { PluginHostRegistrations } from '@core/plugin/host/plugin-host-registrations';
import { PluginGuestRegistrationKind } from '@core/plugin/host/enums/plugin-guest-registration-kind.enum';
import { PluginHost } from '@core/plugin/host/plugin-host';
import { PluginGuestGeneration } from '@core/plugin/host/generations/plugin-guest-generation';

/**
 * A relaunched guest subscribes to `plugins:ready` again through `context.plugins.on`. Clearing the old
 * subscription called `context.plugins.off?.()` — and the real context had no `off`, so nothing was
 * removed. Each relaunch left the previous process's handler ids on the bus, and every later
 * `plugins:ready` invoked them on a guest that never issued them: "guest: unknown handler".
 */
describe('a relaunched guest leaves no stale plugins:ready subscriber', () => {
  it('drops the old subscription through the REAL plugin context', async () => {
    const hooks = new HookManager();
    const manager: any = { hooks, plugins: new Map(), db: {}, jobs: {}, logger: { child: () => ({}) } };
    const plugin: any = { manifest: { slug: 'relaunch-probe', capabilities: ['hooks'] } };
    const logger: any = { child: () => ({ info() {}, warn() {}, error() {}, debug() {} }), info() {}, warn() {}, error() {}, debug() {} };
    const context = PluginContextFactory.createPluginContext(plugin, manager, logger);

    const invoked: string[] = [];
    const registrations = new PluginHostRegistrations('relaunch-probe', {} as any, async (_kind, handlerId) => { invoked.push(String(handlerId)); }, async () => undefined);
    const subscribe = (handlerId: string) => registrations.apply(context, {
      kind: String(PluginGuestRegistrationKind.PLUGINS_ON.value), event: 'plugins:ready', handlerId,
    } as any);

    subscribe('first-process');
    registrations.resetForRestart(context);
    subscribe('second-process');
    hooks.emit('plugins:ready', {});
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(invoked).toEqual(['second-process']);
  });

  it('keeps the old subscriber on the OLD process while the replacement boots, then swaps to the new one in one step', async () => {
    const hooks = new HookManager();
    const manager: any = { hooks, plugins: new Map(), db: {}, jobs: {}, logger: { child: () => ({}) } };
    const logger: any = { child: () => ({ info() {}, warn() {}, error() {}, debug() {} }), info() {}, warn() {}, error() {}, debug() {} };
    const context = PluginContextFactory.createPluginContext({ manifest: { slug: 'relaunch-probe', capabilities: ['hooks'] } } as any, manager, logger);
    const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
    const host = Object.create(PluginHost.prototype) as any;
    // Every forwarded event records WHICH process's channel it went down.
    const calls: string[] = [];
    const registrations = new PluginHostRegistrations('relaunch-probe', {} as any, async (_kind, handlerId) => { calls.push(`${handlerId}@${host.channel.label}`); }, async () => undefined);
    const PLUGINS_ON = String(PluginGuestRegistrationKind.PLUGINS_ON.value);
    registrations.apply(context, { kind: PLUGINS_ON, event: 'plugins:ready', handlerId: 'old-process' } as any);

    const oldChannel = { label: 'old', isClosed: false, pendingCount: 0 };
    const next = new PluginGuestGeneration(2, { pid: 2, socketDir: '/tmp/relaunch-probe.2', kill() {} } as any, { label: 'next', isClosed: false, pendingCount: 0, close() {}, request: async () => undefined } as any);
    next.described = { contractKeys: [], publicApiKeys: [], manifest: {} };
    Object.assign(host, {
      guest: { pid: 1 }, channel: oldChannel, generation: { channel: oldChannel, retireAfter: async () => undefined },
      context, registrations, manager, logger, wasEnabled: false, restarts: 0, healthyTimer: null,
      proxy: { retarget() {}, inFlight: () => 0 }, limits: { timeoutMs: 1000 },
      invoke: async () => undefined,
      // While the replacement boots, another plugin's relaunch announces plugins:ready; the replacement
      // subscribes too, and that registration is HELD until the switch.
      launchGeneration: async () => {
        hooks.emit('plugins:ready', {});
        await tick();
        next.held.push({ kind: PLUGINS_ON, event: 'plugins:ready', handlerId: 'new-process' });
        return next;
      },
    });

    await host.relaunch();
    await tick();

    // Before the switch the old id went to the old process, which issued it; after it, only the new one
    // runs — on the new process (relaunch announces plugins:ready itself once it has switched).
    expect(calls).toEqual(['old-process@old', 'new-process@next']);
    expect(host.channel).toBe(next.channel);
  });
});
