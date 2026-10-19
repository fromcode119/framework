import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PluginInstallationService } from '@core/plugin/services/installation/plugin-installation-service';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';

/**
 * A hot update starts the new process WHILE the old manifest was still the loaded one, and the host
 * checks what the new process registers against that manifest. A release that first declared
 * `"platform": true` therefore had every platform route refused ("its manifest does not declare
 * platform") and `context.platform` throw, so the update failed until an api restart.
 */
describe('PluginInstallationService.finalizeInstalledPlugin — the new manifest is in force while the new process starts', () => {
  let root: string;
  let pluginsRoot: string;
  let pluginPath: string;
  const slug = 'sample-widget';

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'hot-manifest-test-'));
    pluginsRoot = path.join(root, 'plugins');
    pluginPath = path.join(pluginsRoot, slug);
    fs.mkdirSync(pluginPath, { recursive: true });
    fs.writeFileSync(path.join(pluginPath, 'manifest.json'), JSON.stringify({ slug, name: 'Sample Widget', version: '2.0.0', platform: true }));
    fs.writeFileSync(path.join(pluginPath, 'index.js'), '// built server entry\n');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  const service = (plugins: Map<string, ILoadedPlugin>, reloadHost: (s: string, m: any) => Promise<boolean>) => new PluginInstallationService(
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
    reloadHost,
  );
  const existing = (): ILoadedPlugin => ({
    slug, path: pluginPath, state: PluginState.INACTIVE, approvedCapabilities: [],
    manifest: { slug, name: 'Sample Widget', version: '1.0.0' },
  } as unknown as ILoadedPlugin);

  it('the loaded plugin already carries the new manifest when its new process registers', async () => {
    const plugin = existing();
    const plugins = new Map([[slug, plugin]]);
    let seenDuringReload: any = null;
    await service(plugins, async () => { seenDuringReload = plugins.get(slug)!.manifest; return true; }).finalizeInstalledPlugin(slug, {});
    expect(seenDuringReload?.version).toBe('2.0.0');
    expect(seenDuringReload?.platform).toBe(true);
    expect(plugins.get(slug)!.manifest.version).toBe('2.0.0');
  });

  it('keeps the old manifest when the process could not be swapped, since the old code still runs', async () => {
    const plugin = existing();
    const plugins = new Map([[slug, plugin]]);
    await service(plugins, async () => false).finalizeInstalledPlugin(slug, {});
    expect(plugins.get(slug)!.manifest.version).toBe('1.0.0');

    const failing = existing();
    const failingPlugins = new Map([[slug, failing]]);
    await expect(service(failingPlugins, async () => { throw new Error('boot failed'); }).finalizeInstalledPlugin(slug, {})).rejects.toThrow('boot failed');
    expect(failingPlugins.get(slug)!.manifest.version).toBe('1.0.0');
  });
});
