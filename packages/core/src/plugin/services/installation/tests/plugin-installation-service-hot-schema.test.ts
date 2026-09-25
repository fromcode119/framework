import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PluginInstallationService } from '@core/plugin/services/installation/plugin-installation-service';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';

/**
 * A HOT update swaps an isolated plugin's process for one on the new files, and that process
 * registers the collections the new code declares. Only a boot or an activation synced collections to
 * the database, so a release adding a field (finance 0.1.86's `chargeFeeToBuyer`) ran against a table
 * without the column: every read of the collection failed until the api was restarted.
 */
describe('PluginInstallationService.finalizeInstalledPlugin — hot update syncs the schema', () => {
  let root: string;
  let pluginsRoot: string;
  const slug = 'sample-ledger';

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'hot-install-schema-test-'));
    pluginsRoot = path.join(root, 'plugins');
    const pluginPath = path.join(pluginsRoot, slug);
    fs.mkdirSync(pluginPath, { recursive: true });
    fs.writeFileSync(path.join(pluginPath, 'manifest.json'), JSON.stringify({ slug, name: 'Sample Ledger', version: '0.1.2' }));
    fs.writeFileSync(path.join(pluginPath, 'index.js'), '// built server entry\n');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function setup(state: PluginState, reloaded: boolean) {
    const existing = {
      slug,
      path: path.join(pluginsRoot, slug),
      state,
      manifest: { slug, name: 'Sample Ledger', version: '0.1.1' },
      approvedCapabilities: [],
    } as unknown as ILoadedPlugin;
    const syncCollections = vi.fn(async () => undefined);
    const service = new PluginInstallationService(
      { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never,
      {} as never,
      {} as never,
      { migrate: vi.fn(async () => undefined) } as never,
      { savePluginState: vi.fn(async () => undefined), loadInstalledPluginsState: vi.fn(async () => ({})) } as never,
      { scheduleRestart: vi.fn() } as never,
      new Map<string, ILoadedPlugin>([[slug, existing]]),
      pluginsRoot,
      vi.fn(async () => undefined),
      vi.fn(async () => undefined),
      vi.fn(async () => reloaded),
      syncCollections,
    );
    return { service, syncCollections };
  }

  it('syncs an active plugin\'s collections once its new process is running', async () => {
    const { service, syncCollections } = setup(PluginState.ACTIVE, true);
    await service.finalizeInstalledPlugin(slug, {});
    expect(syncCollections).toHaveBeenCalledWith(slug);
  });

  it('leaves an inactive plugin alone — activating it syncs its collections then', async () => {
    const { service, syncCollections } = setup(PluginState.INACTIVE, true);
    await service.finalizeInstalledPlugin(slug, {});
    expect(syncCollections).not.toHaveBeenCalled();
  });

  it('does not sync when the plugin could not be reloaded in place — the api restart that follows does', async () => {
    const { service, syncCollections } = setup(PluginState.ACTIVE, false);
    await service.finalizeInstalledPlugin(slug, {});
    expect(syncCollections).not.toHaveBeenCalled();
  });
});
