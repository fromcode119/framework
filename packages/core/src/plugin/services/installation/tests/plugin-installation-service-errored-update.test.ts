import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PluginInstallationService } from '@core/plugin/services/installation/plugin-installation-service';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';

/**
 * An update to a plugin in ERROR (the security monitor refused a capability it had not declared) went
 * through discover + enable only. Its isolated process was never replaced, so re-enabling it reused
 * the process with the OLD code loaded while the registry reported the new version — the release
 * meant to fix the error never ran.
 */
describe('PluginInstallationService.finalizeInstalledPlugin — updating a plugin in error', () => {
  let root: string;
  let pluginsRoot: string;
  const slug = 'sample-counter';

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'errored-update-test-'));
    pluginsRoot = path.join(root, 'plugins');
    const pluginPath = path.join(pluginsRoot, slug);
    fs.mkdirSync(pluginPath, { recursive: true });
    fs.writeFileSync(path.join(pluginPath, 'manifest.json'), JSON.stringify({ slug, name: 'Sample Counter', version: '0.1.36' }));
    fs.writeFileSync(path.join(pluginPath, 'index.js'), '// built server entry\n');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function setup(state: PluginState) {
    const existing = { slug, path: path.join(pluginsRoot, slug), state, manifest: { slug, name: 'Sample Counter', version: '0.1.35' }, approvedCapabilities: [] } as unknown as ILoadedPlugin;
    const order: string[] = [];
    const reloadHost = vi.fn(async () => { order.push('reload'); return true; });
    const discover = vi.fn(async () => { order.push('discover'); });
    const enable = vi.fn(async () => { order.push('enable'); });
    const service = new PluginInstallationService(
      { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never,
      {} as never,
      {} as never,
      { migrate: vi.fn(async () => undefined) } as never,
      { savePluginState: vi.fn(async () => undefined), loadInstalledPluginsState: vi.fn(async () => ({})) } as never,
      { scheduleRestart: vi.fn() } as never,
      new Map<string, ILoadedPlugin>([[slug, existing]]),
      pluginsRoot,
      discover,
      enable,
      reloadHost,
      vi.fn(async () => undefined),
    );
    return { service, reloadHost, order };
  }

  it('swaps the process onto the new files before the plugin is activated again', async () => {
    const { service, reloadHost, order } = setup(PluginState.ERROR);
    await service.finalizeInstalledPlugin(slug, { enable: true });
    expect(reloadHost).toHaveBeenCalledWith(slug, expect.objectContaining({ version: '0.1.36' }));
    expect(order).toEqual(['reload', 'discover', 'enable']);
  });

  it('a healthy plugin is still replaced once, on the hot path', async () => {
    const { service, reloadHost, order } = setup(PluginState.ACTIVE);
    await service.finalizeInstalledPlugin(slug, {});
    expect(reloadHost).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['reload']);
  });
});
