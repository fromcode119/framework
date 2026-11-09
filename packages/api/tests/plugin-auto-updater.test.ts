import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformSettingsService, SystemConstants } from '@fromcode119/core';
import { PluginAutoUpdater } from '@api/services/plugin-auto-updater';

/**
 * The switch on Settings → Updates must drive the hourly check: off installs nothing, on installs the
 * marketplace's newer versions, and what happened is written where the screen reads it. "Never saved"
 * is the declared default (on), the same value the screen shows.
 */
const META = SystemConstants.META_KEY;
const settings = new Map<string, string>();
const rows = new Map<string, string>();

const db = {
  withPlatformAdmin: async (work: () => Promise<unknown>) => work(),
  find: async (_table: string, query: { where: { key: string } }) => (rows.has(query.where.key) ? [{ key: query.where.key, value: rows.get(query.where.key), tenantId: null }] : []),
  update: async (_table: string, where: { key: string }, data: { value: string }) => { rows.set(where.key, data.value); },
  insert: async (_table: string, data: { key: string; value: string }) => { rows.set(data.key, data.value); },
};
const logger = { info: vi.fn(), error: vi.fn() };
const status = () => JSON.parse(rows.get(META.PLUGINS_AUTO_UPDATE_STATUS) ?? 'null');

describe('PluginAutoUpdater', () => {
  beforeEach(() => {
    settings.clear();
    rows.clear();
    vi.clearAllMocks();
    PlatformSettingsService.registerAccessor(async (key) => settings.get(key) ?? null);
  });

  it('installs what the marketplace has newer and reports it', async () => {
    const updateAllFromMarketplace = vi.fn(async () => ({ updated: ['alpha', 'beta'], failed: [] }));
    await new PluginAutoUpdater({ updateAllFromMarketplace } as any, db, logger).check();

    expect(updateAllFromMarketplace).toHaveBeenCalledTimes(1);
    expect(status()).toMatchObject({ updated: ['alpha', 'beta'], failed: [], error: '' });
    expect(status().checkedAt).toBeTruthy();
    expect(status().updatedAt).toBe(status().checkedAt);
  });

  it('does nothing while the switch is off', async () => {
    settings.set(META.PLUGINS_AUTO_UPDATE, 'false');
    const updateAllFromMarketplace = vi.fn(async () => ({ updated: [], failed: [] }));
    await new PluginAutoUpdater({ updateAllFromMarketplace } as any, db, logger).check();

    expect(updateAllFromMarketplace).not.toHaveBeenCalled();
    expect(rows.has(META.PLUGINS_AUTO_UPDATE_STATUS)).toBe(false);
  });

  it('keeps the last installed batch when a later check finds nothing', async () => {
    const updateAllFromMarketplace = vi.fn()
      .mockResolvedValueOnce({ updated: ['gamma'], failed: [] })
      .mockResolvedValueOnce({ updated: [], failed: [] });
    const updater = new PluginAutoUpdater({ updateAllFromMarketplace } as any, db, logger);
    await updater.check();
    const installedAt = status().updatedAt;
    await updater.check();

    expect(status().updated).toEqual(['gamma']);
    expect(status().updatedAt).toBe(installedAt);
    expect(status().checkedAt >= installedAt).toBe(true);
  });

  it('reports a plugin that could not be updated, and a marketplace that did not answer', async () => {
    const updateAllFromMarketplace = vi.fn()
      .mockResolvedValueOnce({ updated: [], failed: [{ slug: 'delta', error: 'integrity mismatch' }] })
      .mockRejectedValueOnce(new Error('marketplace unreachable'));
    const updater = new PluginAutoUpdater({ updateAllFromMarketplace } as any, db, logger);

    await updater.check();
    expect(status().failed).toEqual([{ slug: 'delta', error: 'integrity mismatch' }]);

    await updater.check();
    expect(status().failed).toEqual([]);
    expect(status().error).toBe('marketplace unreachable');
  });

  it('waits while a platform update is requested', async () => {
    settings.set(META.FRAMEWORK_UPDATE_REQUEST, '0.2.600');
    const updateAllFromMarketplace = vi.fn(async () => ({ updated: [], failed: [] }));
    await new PluginAutoUpdater({ updateAllFromMarketplace } as any, db, logger).check();

    expect(updateAllFromMarketplace).not.toHaveBeenCalled();
  });
});
