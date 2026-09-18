import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PluginInstallationService } from '@core/plugin/services/installation/plugin-installation-service';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { PluginMigrationLoader } from '@core/database/plugin-migration-loader';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';

/**
 * A HOT install/update — no api restart, the plugin's own (isolated) process is just swapped for
 * one running the new files — registers the manifest straight from `manifest.json` on disk. Only
 * the boot-time directory scanner used to fill in `ui.frontendEntry`/`ui.entry`/`migrations` from
 * what the package actually ships; `finalizeInstalledPlugin` read the raw manifest and skipped that
 * step entirely, so a package with `ui/frontend.js` on disk but no `ui` block in its manifest never
 * told the storefront it has a frontend bundle to load — see `PluginPackageLayout`.
 */
describe('PluginInstallationService.finalizeInstalledPlugin — hot install layout resolution', () => {
  let root: string;
  let pluginsRoot: string;
  let pluginPath: string;
  const slug = 'sample-widget';

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'hot-install-layout-test-'));
    pluginsRoot = path.join(root, 'plugins');
    pluginPath = path.join(pluginsRoot, slug);
    fs.mkdirSync(pluginPath, { recursive: true });

    // The package ships a storefront bundle but declares NO `ui` block — the shape a hot-installed
    // build package has when its manifest never named one, or named only `loadStrategy`.
    fs.writeFileSync(
      path.join(pluginPath, 'manifest.json'),
      JSON.stringify({ slug, name: 'Sample Widget', version: '0.1.31' }),
    );
    fs.mkdirSync(path.join(pluginPath, 'src', 'ui'), { recursive: true });
    fs.writeFileSync(path.join(pluginPath, 'src', 'ui', 'frontend.js'), '// built storefront bundle\n');
    fs.writeFileSync(path.join(pluginPath, 'index.js'), '// built server entry\n');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function buildService(plugins: Map<string, ILoadedPlugin>) {
    return new PluginInstallationService(
      { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never,
      {} as never,
      {} as never,
      { migrate: vi.fn(async () => undefined) } as never,
      { savePluginState: vi.fn(async () => undefined), loadInstalledPluginsState: vi.fn(async () => ({})) } as never,
      { scheduleRestart: vi.fn() } as never,
      plugins,
      pluginsRoot,
      vi.fn(async () => undefined),
      vi.fn(async () => undefined),
      // T5 isolated-plugin reload: the process is swapped in place and reports success, which is the
      // hot path that stores `manifest` on the registered `ILoadedPlugin` without any api restart.
      vi.fn(async () => true),
    );
  }

  it('fills ui.frontendEntry on the manifest that ends up registered', async () => {
    const existing: ILoadedPlugin = {
      slug,
      path: pluginPath,
      state: PluginState.ACTIVE,
      manifest: { slug, name: 'Sample Widget', version: '0.1.30' },
      approvedCapabilities: [],
    } as unknown as ILoadedPlugin;
    const plugins = new Map<string, ILoadedPlugin>([[slug, existing]]);
    const service = buildService(plugins);

    await service.finalizeInstalledPlugin(slug, {});

    const registered = plugins.get(slug)!.manifest as unknown as { ui?: { frontendEntry?: string } };
    expect(registered.ui?.frontendEntry).toBe('frontend.js');
  });

  it('does not trigger migrations from a dist/migrations dir that only PluginPackageLayout.resolve() would discover', async () => {
    // The manifest declares no `migrations` field, but the package ships a compiled migrations
    // directory — the same shape PluginPackageLayout.resolve() backfills `manifest.migrations`
    // from. If resolve() ran BEFORE runPluginMigrations, this directory would get picked up and
    // its migration(s) would run on every hot install; ordering it AFTER must leave migration
    // loading untouched, running against the raw (undeclared) manifest value.
    fs.mkdirSync(path.join(pluginPath, 'dist', 'migrations'), { recursive: true });
    fs.writeFileSync(
      path.join(pluginPath, 'dist', 'migrations', '2026-01-01-would-run.js'),
      'exports.up = async () => { throw new Error("this migration must never be loaded"); };\n',
    );

    const loadSpy = vi.spyOn(PluginMigrationLoader, 'load');

    const existing: ILoadedPlugin = {
      slug,
      path: pluginPath,
      state: PluginState.ACTIVE,
      manifest: { slug, name: 'Sample Widget', version: '0.1.30' },
      approvedCapabilities: [],
    } as unknown as ILoadedPlugin;
    const plugins = new Map<string, ILoadedPlugin>([[slug, existing]]);
    const service = buildService(plugins);

    await service.finalizeInstalledPlugin(slug, {});

    // Called with the manifest's own (absent) migrations value, not the path resolve() would have
    // backfilled from dist/migrations.
    expect(loadSpy).toHaveBeenCalledWith(slug, pluginPath, undefined);
    // With no migrations path, the loader short-circuits and returns none to run.
    await expect(loadSpy.mock.results[0].value).resolves.toEqual([]);

    // The ui.* resolution this reorder must still preserve is unaffected.
    const registered = plugins.get(slug)!.manifest as unknown as { ui?: { frontendEntry?: string } };
    expect(registered.ui?.frontendEntry).toBe('frontend.js');

    loadSpy.mockRestore();
  });
});
