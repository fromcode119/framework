import { describe, expect, it } from 'vitest';

import { HookManager } from '@core/hooks/hook-manager';

/**
 * Regression: a plugin that re-initialised inside a LIVE process registered every one of its hooks a
 * second time, so one order emitted two admin confirmation emails (prod, ORD-000342) and decremented
 * stock twice.
 *
 * `on()` stores handlers in a Set, which dedupes by function IDENTITY. Every plugin registers inline
 * arrow functions — a fresh object per call — so the Set never collapsed them, and nothing in the
 * lifecycle removed the previous registration before calling `onInit` again.
 *
 * The fix is owner-tagged registration: handlers registered under a plugin slug can be dropped as a
 * group before that plugin re-registers.
 */
describe('HookManager owner-scoped registration', () => {
  /** Simulates a plugin's `register()` — inline arrows, exactly as every plugin writes them. */
  function registerPluginHooks(hooks: HookManager, owner: string, calls: string[]): void {
    hooks.on('ecommerce:checkout_created', async () => { calls.push('email'); }, owner);
    hooks.on('order.afterSave', async () => { calls.push('stock'); }, owner);
  }

  it('reproduces the duplicate: re-registering without a sweep fires each handler twice', () => {
    const hooks = new HookManager();
    const calls: string[] = [];

    registerPluginHooks(hooks, 'ecommerce', calls);
    registerPluginHooks(hooks, 'ecommerce', calls);
    hooks.emit('ecommerce:checkout_created', {});

    // This is the bug as it shipped — two identical admin emails for one order.
    expect(calls.filter((c) => c === 'email')).toHaveLength(2);
  });

  it('removeAllForOwner drops every handler that owner registered', () => {
    const hooks = new HookManager();
    const calls: string[] = [];

    registerPluginHooks(hooks, 'ecommerce', calls);
    hooks.removeAllForOwner('ecommerce');
    hooks.emit('ecommerce:checkout_created', {});
    hooks.emit('order.afterSave', {});

    expect(calls).toEqual([]);
  });

  it('a sweep-then-register cycle leaves exactly one handler — the re-init fix', () => {
    const hooks = new HookManager();
    const calls: string[] = [];

    registerPluginHooks(hooks, 'ecommerce', calls);
    hooks.removeAllForOwner('ecommerce');
    registerPluginHooks(hooks, 'ecommerce', calls);
    hooks.emit('ecommerce:checkout_created', {});
    hooks.emit('order.afterSave', {});

    expect(calls).toEqual(['email', 'stock']);
  });

  it('never touches another plugin\'s handlers', () => {
    const hooks = new HookManager();
    const ecommerceCalls: string[] = [];
    const logisticsCalls: string[] = [];

    registerPluginHooks(hooks, 'ecommerce', ecommerceCalls);
    hooks.on('ecommerce:checkout_created', async () => { logisticsCalls.push('shipment'); }, 'logistics');

    hooks.removeAllForOwner('ecommerce');
    hooks.emit('ecommerce:checkout_created', {});

    expect(ecommerceCalls).toEqual([]);
    expect(logisticsCalls).toEqual(['shipment']);
  });

  it('never sweeps UNOWNED handlers — the manager\'s own webhook catch-all must survive', () => {
    // plugin-manager registers `hooks.on('*', …)` for webhook delivery with no owner. A sweep that
    // took untagged handlers with it would silently kill webhooks on every plugin re-init.
    const hooks = new HookManager();
    const core: string[] = [];

    hooks.on('*', () => { core.push('webhook'); });
    hooks.on('ecommerce:checkout_created', () => undefined, 'ecommerce');

    hooks.removeAllForOwner('ecommerce');
    hooks.emit('ecommerce:checkout_created', {});

    expect(core).toEqual(['webhook']);
  });

  it('off() still works for an owned handler, and the owner index does not leak it back', () => {
    const hooks = new HookManager();
    const calls: string[] = [];
    const handler = () => { calls.push('x'); };

    hooks.on('some:event', handler, 'ecommerce');
    hooks.off('some:event', handler);
    hooks.emit('some:event', {});
    expect(calls).toEqual([]);

    // A later sweep of that owner must not resurrect or crash on the already-removed handler.
    expect(() => hooks.removeAllForOwner('ecommerce')).not.toThrow();
    hooks.emit('some:event', {});
    expect(calls).toEqual([]);
  });
});
