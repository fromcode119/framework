import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PluginArchiveInstallerService } from '@core/plugin/services/installation/plugin-archive-installer-service';
import { PluginCoreIncompatibleError } from '@core/plugin/services/installation/plugin-core-incompatible-error';
import { PluginPackageValidator } from '@core/plugin/services/installation/plugin-package-validator';

/**
 * A package that needs a newer core than the one running is never written: the installed version keeps
 * running until the core can run the new one, and only then is it replaced.
 */
describe('PluginArchiveInstallerService core requirement', () => {
  let root: string;
  let pluginsRoot: string;
  let pkg: string;

  const write = (dir: string, manifest: object, marker: string) => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
    fs.writeFileSync(path.join(dir, 'index.js'), marker);
  };
  const make = (core: string) => new PluginArchiveInstallerService(
    pluginsRoot,
    { ensureInstalled: vi.fn(async () => undefined) } as never,
    () => core,
  );

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'install-core-test-'));
    pluginsRoot = path.join(root, 'plugins');
    pkg = path.join(root, 'staged', 'guestbook');
    write(path.join(pluginsRoot, 'guestbook'), { slug: 'guestbook', name: 'Guestbook', version: '0.1.0' }, '// old\n');
    write(pkg, { slug: 'guestbook', name: 'Guestbook', version: '0.2.0', engines: { core: '>=0.2.700' } }, '// new\n');
    vi.spyOn(PluginPackageValidator, 'validateInstalledPackage').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('refuses a package that needs a newer core and leaves the installed version untouched', async () => {
    await expect(make('0.2.624').installFromDirectory(pkg)).rejects.toBeInstanceOf(PluginCoreIncompatibleError);
    expect(fs.readFileSync(path.join(pluginsRoot, 'guestbook', 'index.js'), 'utf8')).toBe('// old\n');
  });

  it('installs the same package once the core is new enough', async () => {
    await make('0.2.700').installFromDirectory(pkg);
    expect(fs.readFileSync(path.join(pluginsRoot, 'guestbook', 'index.js'), 'utf8')).toBe('// new\n');
  });
});
