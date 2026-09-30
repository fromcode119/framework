import { describe, expect, it, vi } from 'vitest';
import { PluginRuntimeStateService } from '@core/plugin/services/runtime/plugin-runtime-state-service';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { PluginRegistryHealth } from '@core/plugin/services/enums/plugin-registry-health.enum';

/**
 * A plugin the platform switches off must say why: the admin shows `plugin.error` beside its switch,
 * and the reason — a crash loop, a resource limit, a missing capability — was dropped here, so a
 * plugin turned itself off with nothing on screen explaining it.
 */
describe('disabling a plugin with an error', () => {
  it('keeps the reason for the admin to show', async () => {
    const plugin: any = { manifest: { slug: 'hello-site' }, state: PluginState.ACTIVE };
    const db = { update: vi.fn(async () => null) };
    const service = new PluginRuntimeStateService({} as any, db, {} as any, new Map([['hello-site', plugin]]), new Map(), new Map(), new Map());

    await service.disableWithError('hello-site', 'Isolated plugin process failed repeatedly: stopped because this plugin used 60 MB of memory; the limit for this plugin is 50 MB');

    expect(plugin.state).toBe(PluginState.ERROR);
    expect(plugin.healthStatus).toBe(PluginRegistryHealth.ERROR);
    expect(plugin.error).toContain('the limit for this plugin is 50 MB');
  });
});

describe('a plugin the platform stopped', () => {
  it('is marked as stopped by the platform, so a rescan does not start it again', async () => {
    const plugin: any = { manifest: { slug: 'hello-site' }, state: PluginState.ACTIVE };
    const service = new PluginRuntimeStateService({} as any, { update: vi.fn(async () => null) }, {} as any, new Map([['hello-site', plugin]]), new Map(), new Map(), new Map());
    await service.disableWithError('hello-site', 'Isolated plugin process failed repeatedly: process exited (1)');
    expect(plugin.stoppedByPlatform).toBe(true);
  });
});
