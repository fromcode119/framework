import { afterEach, describe, expect, it, vi } from 'vitest';
import { PluginSeedRunner } from '@core/plugin/services/runtime/plugin-seed-runner';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { PluginTenantAccess } from '@core/plugin/tenant/plugin-tenant-access';

/**
 * A new site ran EVERY platform-active plugin's seed: a site created with cms and forms also got the
 * finance plugin's currencies. The per-site pass must seed only the plugins that site runs.
 */
describe('PluginSeedRunner.runSeedsForCurrentSite', () => {
  afterEach(() => vi.restoreAllMocks());

  const plugin = (slug: string, extra: Record<string, unknown> = {}) =>
    [slug, { state: PluginState.ACTIVE, manifest: { slug, seeds: 'seed.ts', ...extra } }] as const;

  it('seeds only the plugins enabled for the site in scope', async () => {
    vi.spyOn(PluginTenantAccess, 'isVisibleForCurrentTenant').mockImplementation((p: any) => ['cms', 'forms'].includes(p.manifest.slug));
    const runSeeds = vi.fn(async () => undefined);
    const manager = { plugins: new Map<string, any>([plugin('cms'), plugin('finance'), plugin('forms'), plugin('logistics')]) };

    const seeded = await new PluginSeedRunner(manager as never, { runSeeds } as never).runSeedsForCurrentSite();

    expect(seeded).toEqual(['cms', 'forms']);
    expect(runSeeds.mock.calls.map((call) => call[0])).toEqual(['cms', 'forms']);
  });

  it('still skips an inactive plugin, and one that declares no seed', async () => {
    vi.spyOn(PluginTenantAccess, 'isVisibleForCurrentTenant').mockReturnValue(true);
    const runSeeds = vi.fn(async () => undefined);
    const manager = { plugins: new Map<string, any>([
      ['off', { state: PluginState.INACTIVE, manifest: { slug: 'off', seeds: 'seed.ts' } }],
      ['bare', { state: PluginState.ACTIVE, manifest: { slug: 'bare' } }],
      plugin('cms'),
    ]) };

    expect(await new PluginSeedRunner(manager as never, { runSeeds } as never).runSeedsForCurrentSite()).toEqual(['cms']);
  });
});
