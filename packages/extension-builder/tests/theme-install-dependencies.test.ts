import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Core } from '@extension-builder/core-bridge';
import { ThemeBundleCompiler } from '@extension-builder/compile/theme-bundle-compiler';

/**
 * A theme built on a machine that has not installed it by hand: the compiler installs its dependencies.
 * It once ran a raw `npm install` of its own, and every theme lists `vitest`, whose peer set crashes npm's
 * resolver without `--legacy-peer-deps` — so a theme made from the scaffold could not be built. The one
 * copy of how this platform runs npm (`DependencyInstaller`) carries that flag and `--ignore-scripts`.
 */
describe('ThemeBundleCompiler theme dependencies', () => {
  const directories: string[] = [];
  afterEach(() => {
    vi.restoreAllMocks();
    directories.splice(0).forEach((directory) => fs.rmSync(directory, { recursive: true, force: true }));
  });

  const theme = (options: { manifest?: boolean; modules?: boolean }): string => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'theme-install-'));
    directories.push(directory);
    if (options.manifest !== false) fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ name: 't', dependencies: { react: '19.0.0' }, devDependencies: { vitest: '^4.1.8' } }));
    if (options.modules) fs.mkdirSync(path.join(directory, 'node_modules'));
    return directory;
  };

  const install = (directory: string): Promise<void> => (new ThemeBundleCompiler() as any).installThemeDependencies(directory);

  it('installs through the shared installer, runtime dependencies only', async () => {
    const spy = vi.spyOn(Core.DependencyInstaller, 'install').mockResolvedValue(undefined);
    const directory = theme({});

    await install(directory);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(directory, { omitDev: true });
  });

  it('leaves a theme that already has node_modules, and one with no package.json, alone', async () => {
    const spy = vi.spyOn(Core.DependencyInstaller, 'install').mockResolvedValue(undefined);

    await install(theme({ modules: true }));
    await install(theme({ manifest: false }));

    expect(spy).not.toHaveBeenCalled();
  });

  it('passes the failure on instead of building without the dependencies', async () => {
    vi.spyOn(Core.DependencyInstaller, 'install').mockRejectedValue(new Error('Dependency install failed'));

    await expect(install(theme({}))).rejects.toThrow('Dependency install failed');
  });
});
