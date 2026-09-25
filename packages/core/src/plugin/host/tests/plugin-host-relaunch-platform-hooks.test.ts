import { describe, expect, it } from 'vitest';
import { HookManager } from '@core/hooks/hook-manager';
import { PluginContextFactory } from '@core/plugin/context';
import { PluginHostRegistrations } from '@core/plugin/host/plugin-host-registrations';
import { PluginGuestRegistrationKind } from '@core/plugin/host/enums/plugin-guest-registration-kind.enum';
import { PluginHost } from '@core/plugin/host/plugin-host';

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

  it('drops them BEFORE the new process boots, so a peer relaunching meanwhile cannot reach them', async () => {
    const hooks = new HookManager();
    const manager: any = { hooks, plugins: new Map(), db: {}, jobs: {}, logger: { child: () => ({}) } };
    const logger: any = { child: () => ({ info() {}, warn() {}, error() {}, debug() {} }), info() {}, warn() {}, error() {}, debug() {} };
    const context = PluginContextFactory.createPluginContext({ manifest: { slug: 'relaunch-probe', capabilities: ['hooks'] } } as any, manager, logger);
    const invoked: string[] = [];
    const registrations = new PluginHostRegistrations('relaunch-probe', {} as any, async (_kind, handlerId) => { invoked.push(String(handlerId)); }, async () => undefined);
    registrations.apply(context, { kind: String(PluginGuestRegistrationKind.PLUGINS_ON.value), event: 'plugins:ready', handlerId: 'old-process' } as any);

    const host = Object.create(PluginHost.prototype) as any;
    // While this guest boots, another plugin's relaunch announces plugins:ready.
    Object.assign(host, { guest: null, channel: null, context, registrations, manager, wasEnabled: false,
      start: async () => { hooks.emit('plugins:ready', {}); await new Promise((resolve) => setTimeout(resolve, 0)); },
      invoke: async () => undefined });
    await host.relaunch();

    expect(invoked).not.toContain('old-process');
  });
});
