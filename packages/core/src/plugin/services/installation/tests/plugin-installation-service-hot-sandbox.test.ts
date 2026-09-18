import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PluginInstallationService } from '@core/plugin/services/installation/plugin-installation-service';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { PluginIsolationSettings } from '@core/plugin/host/plugin-isolation-settings';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';

/**
 * A HOT install/update (isolated plugin, `reloadHost` swaps its process in place with no api
 * restart) used to register the manifest read STRAIGHT off disk: no `ManifestNormalizer`, no
 * lowercased slug, no `ownerTenantId` stamp, and — the operator-visible defect — no merge of the
 * persisted sandboxConfig or the plugin's own saved settings. The plugin's process came back on the
 * PLATFORM DEFAULT memory/timeout and the shipped manifest's default config, discarding whatever the
 * operator had configured, until the next full api restart put the boot scanner back in charge.
 */
describe('PluginInstallationService.finalizeInstalledPlugin — hot install preserves sandbox + config', () => {
  let root: string;
  let pluginsRoot: string;
  let pluginPath: string;
  // A neutral fixture slug, mixed-case on disk — the boot scanner has always lowercased this and a
  // hot install/update must land on the exact same slug the operator's persisted state is keyed by.
  const diskSlug = 'Sample-Widget';
  const lowerSlug = 'sample-widget';

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'hot-install-sandbox-test-'));
    pluginsRoot = path.join(root, 'plugins');
    pluginPath = path.join(pluginsRoot, diskSlug);
    fs.mkdirSync(pluginPath, { recursive: true });

    // No `sandbox` key at all, and a declared ownerTenantId the directory-based stamp must strip.
    fs.writeFileSync(
      path.join(pluginPath, 'manifest.json'),
      JSON.stringify({ slug: diskSlug, name: 'Sample Widget', version: '2.0.0', ownerTenantId: 'someone-elses-tenant' }),
    );
    fs.writeFileSync(path.join(pluginPath, 'index.js'), '// built server entry\n');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('hands reloadHost a manifest with the persisted sandbox config, lowercased slug, no ownerTenantId, and the carried-over plugin config', async () => {
    const existing: ILoadedPlugin = {
      slug: diskSlug,
      path: pluginPath,
      state: PluginState.ACTIVE,
      manifest: { slug: diskSlug, name: 'Sample Widget', version: '1.0.0', config: { key: 'saved' } },
      approvedCapabilities: [],
    } as unknown as ILoadedPlugin;
    const plugins = new Map<string, ILoadedPlugin>([[diskSlug, existing]]);

    const savePluginState = vi.fn(async () => undefined);
    const reloadHost = vi.fn(async () => true);

    const service = new PluginInstallationService(
      { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never,
      {} as never,
      {} as never,
      { migrate: vi.fn(async () => undefined) } as never,
      {
        savePluginState,
        loadInstalledPluginsState: vi.fn(async () => ({
          [lowerSlug]: {
            state: PluginState.ACTIVE,
            sandboxConfig: { memoryLimit: 512, timeout: 5000 },
          },
        })),
      } as never,
      { scheduleRestart: vi.fn() } as never,
      plugins,
      pluginsRoot,
      vi.fn(async () => undefined),
      vi.fn(async () => undefined),
      reloadHost,
    );

    await service.finalizeInstalledPlugin(diskSlug, {});

    expect(reloadHost).toHaveBeenCalledTimes(1);
    const [handedSlug, handedManifest] = reloadHost.mock.calls[0] as [string, any];
    expect(handedSlug).toBe(diskSlug);

    expect(handedManifest.slug).toBe(lowerSlug);
    expect(handedManifest.category).toBe('general');
    expect(handedManifest.ownerTenantId).toBeUndefined();
    expect(handedManifest.sandbox).toEqual({ memoryLimit: 512, timeout: 5000 });
    expect(handedManifest.config).toBe(existing.manifest.config);

    // Tied to the real resolver a fresh guest process boots with — this is what proves the operator's
    // 512/5000 actually reaches the process instead of the platform default.
    expect(PluginIsolationSettings.defaults().forPlugin(handedManifest.sandbox)).toEqual({
      memoryMb: 512,
      timeoutMs: 5000,
    });

    // The registered ILoadedPlugin's manifest is the SAME object handed to reloadHost.
    expect(plugins.get(diskSlug)!.manifest).toBe(handedManifest);
  });
});
