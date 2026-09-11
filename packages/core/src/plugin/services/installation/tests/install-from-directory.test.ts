import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PluginArchiveInstallerService } from '@core/plugin/services/installation/plugin-archive-installer-service';
import { PluginPackageValidator } from '@core/plugin/services/installation/plugin-package-validator';

/**
 * Installing a package DIRECTORY — what a build on this installation produces.
 *
 * The two entry points share everything after the files are located, because a difference between
 * them is an extension that installs correctly only one of the two ways. Two behaviours in that
 * shared half are load-bearing and are asserted here: a mounted git checkout is refused (a developer's
 * working tree is not an installed artifact, and an install over one deletes the TypeScript, the
 * tests and the repository metadata — which happened once), and the staged package survives the
 * install, because a download still has to be able to archive it afterwards.
 */
describe('PluginArchiveInstallerService.installFromDirectory', () => {
  let root: string;
  let pluginsRoot: string;
  let pkg: string;
  let service: any;

  const manifest = { slug: 'forms', name: 'Forms', version: '0.1.31' };

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'install-dir-test-'));
    pluginsRoot = path.join(root, 'plugins');
    pkg = path.join(root, 'staged', 'forms-0.1.31');
    fs.mkdirSync(pluginsRoot, { recursive: true });
    fs.mkdirSync(pkg, { recursive: true });
    fs.writeFileSync(path.join(pkg, 'manifest.json'), JSON.stringify(manifest));
    fs.writeFileSync(path.join(pkg, 'index.js'), '// built\n');

    service = new PluginArchiveInstallerService(
      pluginsRoot,
      { ensureInstalled: vi.fn(async () => undefined) } as never,
    );
    // The validator asserts a compiled package; the package's shape is not what these tests are about.
    vi.spyOn(PluginPackageValidator, 'validateInstalledPackage').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('puts the package in place under the plugins root', async () => {
    const result = await service.installFromDirectory(pkg);

    expect(result.slug).toBe('forms');
    expect(fs.existsSync(path.join(pluginsRoot, 'forms', 'index.js'))).toBe(true);
  });

  it('LEAVES the staged package where it is, so a download can still archive it', async () => {
    await service.installFromDirectory(pkg);

    expect(fs.existsSync(path.join(pkg, 'index.js'))).toBe(true);
  });

  it('refuses to install over a git checkout — a working tree is not an installed artifact', async () => {
    const target = path.join(pluginsRoot, 'forms');
    fs.mkdirSync(path.join(target, '.git'), { recursive: true });
    fs.writeFileSync(path.join(target, 'index.ts'), 'export class FormsPlugin {}\n');

    await expect(service.installFromDirectory(pkg)).rejects.toThrow();
    // The developer's source is untouched.
    expect(fs.existsSync(path.join(target, 'index.ts'))).toBe(true);
  });

  it('refuses a path that is not a directory rather than treating it as one', async () => {
    const file = path.join(root, 'forms.zip');
    fs.writeFileSync(file, 'PK');

    await expect(service.installFromDirectory(file)).rejects.toThrow(/not a directory/);
  });
});
