import { describe, expect, it } from 'vitest';
import { HookManager } from '@core/hooks/hook-manager';
import { PluginContextFactory } from '@core/plugin/context';
import { PluginHostRegistrations } from '@core/plugin/host/plugin-host-registrations';
import { PluginGuestRegistrationKind } from '@core/plugin/host/enums/plugin-guest-registration-kind.enum';
import { PluginHostState } from '@core/plugin/host/plugin-host-state';
import { MiddlewareManager } from '@core/plugin/services/runtime/middleware-manager';

/**
 * When the extension-host came back, every plugin's relaunch said `plugins:ready`, and the stand-ins of
 * the plugins still waiting their turn forwarded it to a process that was not running: one ERROR with a
 * stack trace per plugin per relaunch (seen on production 2026-09-27). A paused plugin now skips
 * `plugins:ready` — it hears its own once its relaunch is done — and every other event still reaches it.
 */
describe('a plugin whose process is down', () => {
  const setUp = (running: { value: boolean }) => {
    const hooks = new HookManager();
    const manager: any = { hooks, plugins: new Map(), db: {}, jobs: {}, logger: { child: () => ({}) }, middlewares: new MiddlewareManager() };
    const logger: any = { child: () => ({ info() {}, warn() {}, error() {}, debug() {} }), info() {}, warn() {}, error() {}, debug() {} };
    const context = PluginContextFactory.createPluginContext({ manifest: { slug: 'paused-probe', capabilities: ['hooks'] } } as any, manager, logger);
    const invoked: string[] = [];
    const registrations = new PluginHostRegistrations('paused-probe', {} as any, async (_kind, handlerId, args) => { invoked.push(`${handlerId}:${String(args[1])}`); }, async () => undefined, {} as any, async () => undefined, () => running.value);
    registrations.apply(context, { kind: String(PluginGuestRegistrationKind.PLUGINS_ON.value), event: PluginHostState.PLUGINS_READY_EVENT, handlerId: 'ready' } as any);
    // Both stand-in kinds share one rule; the platform bus has no site gate for this bare context to pass.
    registrations.apply(context, { kind: String(PluginGuestRegistrationKind.PLUGINS_ON.value), event: 'order.created', handlerId: 'order' } as any);
    return { hooks, invoked };
  };
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('is not asked about plugins:ready, but still about every other event', async () => {
    const { hooks, invoked } = setUp({ value: false });
    hooks.emit(PluginHostState.PLUGINS_READY_EVENT, { plugins: [], restarted: 'another-plugin' });
    hooks.emit('order.created', { id: 1 });
    await tick();
    expect(invoked).toEqual(['order:order.created']);
  });

  it('is asked about plugins:ready again once it runs', async () => {
    const running = { value: false };
    const { hooks, invoked } = setUp(running);
    hooks.emit(PluginHostState.PLUGINS_READY_EVENT, { plugins: [] });
    running.value = true;
    hooks.emit(PluginHostState.PLUGINS_READY_EVENT, { plugins: [], restarted: 'paused-probe' });
    await tick();
    expect(invoked).toEqual(['ready:plugins:ready']);
  });
});
