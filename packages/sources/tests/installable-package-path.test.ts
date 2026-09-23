import { ExtensionScope } from '@fromcode119/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BuiltPackageService } from '@sources/packaging/built-package-service';
import { BuildSourceIdentity } from '@sources/sources/build-source-identity';
import { SourcesCollectionRegistry } from '@sources/sources/sources-tables';

/**
 * What the catalogue hands an installer when the offer came from THIS installation.
 *
 * It used to answer with the archive alone, and a build does not write one — it stages a directory,
 * and the zip appears only when somebody presses Download. So on any installation where nobody had
 * downloaded a package, this answered null for every source: the catalogue offered the plugin, the
 * install then reported "offered by this installation but its package could not be found", and the
 * admin's Update button failed for every locally built plugin. Measured on production: `file_name`
 * was empty for all 20 of them.
 *
 * The staged directory is a first-class answer — the installer already branches on `isDirectory()`.
 */
describe('BuiltPackageService — the installable package', () => {
  const identity = BuildSourceIdentity.parse(ExtensionScope.PLUGIN, 'guestbook') as BuildSourceIdentity;
  let root: string;
  let service: any;
  let entry: Record<string, unknown>;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'installable-'));
    entry = { version: '0.1.31', file_name: '' };
    service = Object.create(BuiltPackageService.prototype);
    service.buildsSlug = SourcesCollectionRegistry.BUILDS;
    service.db = { findOne: vi.fn(async () => entry) };
    service.packageBuilder = {
      outputDirFor: () => path.join(root, 'plugins'),
      stagingDirFor: (_t: ExtensionScope, slug: string, version: string) =>
        path.join(root, 'plugins', 'packages', `${slug}-${version}`),
    };
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  const stageDirectory = () =>
    fs.mkdirSync(path.join(root, 'plugins', 'packages', 'guestbook-0.1.31'), { recursive: true });

  const writeArchive = () => {
    fs.mkdirSync(path.join(root, 'plugins'), { recursive: true });
    fs.writeFileSync(path.join(root, 'plugins', 'guestbook-0.1.31.zip'), 'zip');
  };

  it('answers with the staged DIRECTORY when no archive was written', async () => {
    // The case that broke every Update button: built, never downloaded.
    stageDirectory();

    expect(await service.resolveInstallablePackagePath(identity))
      .toBe(path.join(root, 'plugins', 'packages', 'guestbook-0.1.31'));
  });

  it('prefers the archive when one exists', async () => {
    stageDirectory();
    writeArchive();
    entry.file_name = 'guestbook-0.1.31.zip';

    expect(await service.resolveInstallablePackagePath(identity))
      .toBe(path.join(root, 'plugins', 'guestbook-0.1.31.zip'));
  });

  it('falls back to the directory when the recorded archive is gone', async () => {
    // A pruned workspace leaves the row's filename pointing at nothing. Reporting "not found" while a
    // perfectly good staged package sits beside it is the failure this method exists to stop.
    stageDirectory();
    entry.file_name = 'guestbook-0.1.31.zip';

    expect(await service.resolveInstallablePackagePath(identity))
      .toBe(path.join(root, 'plugins', 'packages', 'guestbook-0.1.31'));
  });

  it('answers null when neither exists, rather than a path that cannot be opened', async () => {
    // The caller does `statSync` on whatever comes back; a hopeful path throws ENOENT inside it
    // instead of producing the message that names the real problem.
    expect(await service.resolveInstallablePackagePath(identity)).toBeNull();
  });

  it('answers null when no build has been recorded', async () => {
    entry = {} as Record<string, unknown>;
    service.db.findOne = vi.fn(async () => null);

    expect(await service.resolveInstallablePackagePath(identity)).toBeNull();
  });
});
