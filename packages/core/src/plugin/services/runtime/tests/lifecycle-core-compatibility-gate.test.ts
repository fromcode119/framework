import { afterEach, describe, expect, it, vi } from 'vitest';
import { LifecycleService } from '@core/plugin/services/runtime/lifecycle-service';
import { PluginHeldReason } from '@core/plugin/services/enums/plugin-held-reason.enum';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';

/**
 * A plugin that outran the core (its build needs a newer platform than this installation runs) must be
 * HELD at enable, never activated — otherwise its UI bundle fails to import and takes every component of
 * the plugin down with it. The gate sits before the dependency check so a compatible plugin passes
 * straight through to it.
 */
describe('LifecycleService.enable — core compatibility gate', () => {
  afterEach(() => vi.restoreAllMocks());

  function lifecycleWith(plugin: any, running: string, discovery: any = { checkDependencies: vi.fn().mockReturnValue([]) }) {
    const manager: any = { plugins: new Map([[plugin.manifest.slug, plugin]]), db: {} };
    const svc = new LifecycleService(manager, {} as never, discovery, {} as never, () => running);
    return { svc, manager, discovery };
  }

  it('holds a plugin that needs a newer core than this installation runs, and never activates it', async () => {
    const plugin = { manifest: { slug: 'ecommerce', version: '0.1.483', engines: { core: '>=0.2.603' } }, state: PluginState.INACTIVE };
    const { svc, discovery } = lifecycleWith(plugin, '0.2.602');
    const hold = vi.spyOn(svc.approval, 'hold').mockResolvedValue();

    await svc.enable('ecommerce');

    expect(hold).toHaveBeenCalledTimes(1);
    expect(hold.mock.calls[0][0]).toBe('ecommerce');
    expect(hold.mock.calls[0][1]).toBe(PluginHeldReason.CORE_TOO_OLD);
    expect(hold.mock.calls[0][2]).toMatchObject({ text: expect.stringContaining('>=0.2.603') });
    expect(plugin.state).not.toBe(PluginState.ACTIVE);
    // The gate returns before the dependency check even runs.
    expect(discovery.checkDependencies).not.toHaveBeenCalled();
  });

  it('a compatible plugin passes the core gate and reaches the dependency check', async () => {
    const plugin = { manifest: { slug: 'ecommerce', version: '0.1.491', engines: { core: '>=0.2.603' } }, state: PluginState.INACTIVE };
    const discovery = { checkDependencies: vi.fn().mockReturnValue([{ type: 'MISSING', slug: 'dep' }]) };
    const { svc } = lifecycleWith(plugin, '0.2.606', discovery);
    const hold = vi.spyOn(svc.approval, 'hold').mockResolvedValue();

    // A MISSING dependency makes the non-recursive path throw — proof the core gate let it through.
    await expect(svc.enable('ecommerce')).rejects.toThrow(/DEPENDENCY_ISSUES/);
    expect(hold).not.toHaveBeenCalled();
    expect(discovery.checkDependencies).toHaveBeenCalledTimes(1);
  });

  it('a plugin with no core requirement passes the core gate (reaches the dependency check)', async () => {
    const plugin = { manifest: { slug: 'legacy', version: '1.0.0' }, state: PluginState.INACTIVE };
    const discovery = { checkDependencies: vi.fn().mockReturnValue([{ type: 'MISSING', slug: 'dep' }]) };
    const { svc } = lifecycleWith(plugin, '0.2.602', discovery);
    const hold = vi.spyOn(svc.approval, 'hold').mockResolvedValue();

    await expect(svc.enable('legacy')).rejects.toThrow(/DEPENDENCY_ISSUES/);
    expect(hold).not.toHaveBeenCalled();
    expect(discovery.checkDependencies).toHaveBeenCalledTimes(1);
  });
});
