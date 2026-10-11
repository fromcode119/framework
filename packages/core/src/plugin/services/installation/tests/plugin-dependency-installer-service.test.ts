import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PluginDependencyInstallerService } from '@core/plugin/services/installation/plugin-dependency-installer-service';
import { DependencyInstaller } from '@core/plugin/services/installation/dependency-installer';

/**
 * `package.json` is inside a plugin's integrity hash, and this runs on every boot of an already-stamped
 * plugin. A plugin repository that declares the SDK for its own tests used to come out of the boot with
 * a rewritten manifest — and was refused at the integrity check that followed.
 */
describe('installing a stamped plugin\'s dependencies at boot', () => {
  const dirs: string[] = [];
  afterEach(() => {
    vi.restoreAllMocks();
    for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  const pluginWith = (pkg: Record<string, unknown>): { dir: string; text: string } => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-deps-'));
    dirs.push(dir);
    const text = `${JSON.stringify(pkg, null, 2)}\n`;
    fs.writeFileSync(path.join(dir, 'package.json'), text);
    return { dir, text };
  };

  it('installs without the host-provided packages and leaves package.json byte for byte as it was', async () => {
    const { dir, text } = pluginWith({ name: 'p', peerDependencies: { '@fromcode119/sdk': '^0.1.0' }, devDependencies: { '@fromcode119/sdk': '^0.1.59', vitest: '^4' }, dependencies: { handlebars: '^4' } });
    let seenDuringInstall = '';
    vi.spyOn(DependencyInstaller, 'install').mockImplementation(async (directory: string) => {
      seenDuringInstall = fs.readFileSync(path.join(directory, 'package.json'), 'utf8');
    });
    await new PluginDependencyInstallerService(dir).ensureInstalled(dir);
    expect(seenDuringInstall).not.toContain('@fromcode119/');
    expect(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).toBe(text);
  });

  it('puts it back when nothing needed installing, and when the install failed', async () => {
    const { dir, text } = pluginWith({ name: 'p', devDependencies: { '@fromcode119/sdk': '^0.1.59' } });
    vi.spyOn(DependencyInstaller, 'install').mockResolvedValue(undefined);
    const service = new PluginDependencyInstallerService(dir);
    fs.mkdirSync(path.join(dir, 'node_modules'));
    await service.ensureInstalled(dir);
    await service.ensureInstalled(dir);
    expect(DependencyInstaller.install).toHaveBeenCalledTimes(1);
    expect(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).toBe(text);

    const failing = pluginWith({ name: 'q', devDependencies: { '@fromcode119/sdk': '^0.1.59' } });
    vi.spyOn(DependencyInstaller, 'install').mockRejectedValue(new Error('npm down'));
    await expect(new PluginDependencyInstallerService(failing.dir).ensureInstalled(failing.dir)).rejects.toThrow('npm down');
    expect(fs.readFileSync(path.join(failing.dir, 'package.json'), 'utf8')).toBe(failing.text);
  });
});
