import { afterEach, describe, expect, it, vi } from 'vitest';
import { LifecycleService } from '@core/plugin/services/runtime/lifecycle-service';
import { PluginCollectionActivationService } from '@core/plugin/services/plugin-collection-activation-service';

/**
 * A hot update puts an active plugin's new code in place without the api restarting. Booting and enabling
 * synced its tables AND created the default pages its contracts require; the hot update only synced tables,
 * so a release's new required pages stayed 404 on every site until a restart.
 */
describe('LifecycleService.refreshAfterHotUpdate', () => {
  afterEach(() => vi.restoreAllMocks());

  it('syncs the plugin\'s tables, then creates the default pages it requires', async () => {
    const calls: string[] = [];
    vi.spyOn(PluginCollectionActivationService.prototype, 'syncPluginCollections').mockImplementation(async (slug: string) => { calls.push(`sync:${slug}`); });
    vi.spyOn(PluginCollectionActivationService.prototype, 'materializeDefaultPages').mockImplementation(async (slug?: string) => { calls.push(`pages:${slug}`); });
    const lifecycle = new LifecycleService({ plugins: new Map() } as never, {} as never, {} as never, {} as never);

    await lifecycle.refreshAfterHotUpdate('sample-shop');

    expect(calls).toEqual(['sync:sample-shop', 'pages:sample-shop']);
  });
});
