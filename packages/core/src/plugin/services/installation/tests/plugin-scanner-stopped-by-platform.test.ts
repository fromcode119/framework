import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectPaths } from '@core/config/paths';
import { PluginDirectoryScannerService } from '@core/plugin/services/installation/plugin-directory-scanner-service';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';

/**
 * The Plugins page rescans (`?refresh=true`), and describing an isolated plugin starts its process. A
 * plugin the PLATFORM stopped while it ran — a crash loop, a resource limit — was started again that
 * way, so opening the page brought back what had just been stopped and wiped the reason with it.
 */
const ROOTS: string[] = [];
const tempRoot = (prefix: string) => { const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); ROOTS.push(root); return root; };

function writeSitePlugin(pluginsRoot: string, slug: string): void {
  const dir = path.join(pluginsRoot, 'tenants', 'acme', slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ slug, version: '1.0.0', name: 'X', capabilities: ['api'] }));
  fs.writeFileSync(path.join(dir, 'index.js'), 'module.exports = {};');
}

function scanner(pluginsRoot: string, hosts: any) {
  vi.spyOn(ProjectPaths, 'getBundledPluginsDir').mockReturnValue(path.join(tempRoot('fc-bundled-'), 'none'));
  vi.spyOn(ProjectPaths, 'getThemesDir').mockReturnValue(tempRoot('fc-themes-'));
  const logger: any = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return new (PluginDirectoryScannerService as any)(pluginsRoot, pluginsRoot, logger, { ensureInstalled: vi.fn(async () => undefined) }, hosts);
}

afterEach(() => {
  vi.restoreAllMocks();
  while (ROOTS.length) fs.rmSync(ROOTS.pop() as string, { recursive: true, force: true });
});

describe('a rescan', () => {
  const hosts = () => ({ isIsolated: vi.fn(async () => true), isolatesIdentity: () => true, describe: vi.fn(async () => ({})) });

  it('does not start a plugin the platform stopped while it ran', async () => {
    const root = tempRoot('fc-plugins-');
    writeSitePlugin(root, 'hello-site');
    const h = hosts();
    const existing = new Map<string, any>([['hello-site', { manifest: { slug: 'hello-site' }, state: PluginState.ERROR, error: 'stopped because this plugin used 60 MB of memory', stoppedByPlatform: true }]]);

    const result = await scanner(root, h).discoverPlugins(existing, {});

    expect(h.describe).not.toHaveBeenCalled();
    expect(result.discovered.map((d: any) => d.plugin.manifest.slug)).not.toContain('hello-site');
    expect(existing.get('hello-site').error).toContain('60 MB');
  });

  it('still retries a plugin that failed to load', async () => {
    const root = tempRoot('fc-plugins-');
    writeSitePlugin(root, 'hello-site');
    const h = hosts();
    const existing = new Map<string, any>([['hello-site', { manifest: { slug: 'hello-site' }, state: PluginState.ERROR, error: 'Cannot find module' }]]);

    const result = await scanner(root, h).discoverPlugins(existing, {});

    expect(h.describe).toHaveBeenCalledTimes(1);
    expect(result.discovered.map((d: any) => d.plugin.manifest.slug)).toContain('hello-site');
  });
});
