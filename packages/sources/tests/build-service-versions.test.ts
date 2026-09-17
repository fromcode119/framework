import { ExtensionScope } from '@fromcode119/core';
import { BuildSourceIdentity } from '@sources/sources/build-source-identity';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BuiltPackageService } from '@sources/packaging/built-package-service';
import { SourcesCollectionRegistry } from '@sources/sources/sources-tables';

/**
 * Going back to a version this installation already built.
 *
 * Nothing prunes a staged package: a build clears its OWN version's directory and leaves every
 * other, so the versions still installable are simply the ones still on disk. That makes a downgrade
 * a listing problem rather than a rebuild — and makes the listing the thing that must be right.
 *
 * The other half is that "built" and "installed" are recorded in DIFFERENT places. A source reported
 * only what it last built, so an installation could say "built 0.1.31" for weeks while 0.1.20 served
 * every request and no screen compared the two.
 */
describe('BuiltPackageService — versions', () => {
  const identity = BuildSourceIdentity.parse(ExtensionScope.PLUGIN, 'forms') as BuildSourceIdentity;
  let service: any;
  let staged: string[];
  let installed: string | null;
  let installCalls: Array<{ dir: string; options: any }>;

  beforeEach(() => {
    staged = ['0.1.31', '0.1.9', '0.1.20'];
    installed = '0.1.20';
    installCalls = [];
    service = Object.create(BuiltPackageService.prototype);
    service.buildsSlug = SourcesCollectionRegistry.BUILDS;
    service.logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    service.packageBuilder = {
      listStagedVersions: vi.fn(() => [...staged]),
      stagingDirFor: (_t: ExtensionScope, slug: string, version: string) => `/w/plugins/packages/${slug}-${version}`,
    };
    service.db = { findOne: vi.fn(async () => ({ version: '0.1.31' })) };
    service.installer = {
      installedExtensionVersion: vi.fn(async () => installed),
      installExtensionDirectory: vi.fn(async (dir: string, _s: ExtensionScope, options: any) => {
        installCalls.push({ dir, options });
      }),
    };
  });

  it('reports installed and built as separate facts', async () => {
    const answer = await service.listVersions(identity);

    expect(answer.installed).toBe('0.1.20');
    expect(answer.built).toBe('0.1.31');
  });

  it('says nothing is installed rather than guessing, when nothing is', async () => {
    installed = null;
    expect((await service.listVersions(identity)).installed).toBeNull();
  });

  it('installs the exact version asked for', async () => {
    await service.installVersion(identity, '0.1.9');

    expect(installCalls).toHaveLength(1);
    expect(installCalls[0].dir).toBe('/w/plugins/packages/forms-0.1.9');
  });

  it('does not ACTIVATE what it installs — putting a version back is not choosing a theme', async () => {
    await service.installVersion(identity, '0.1.9');
    expect(installCalls[0].options).toMatchObject({ activate: false });
  });

  it('refuses a version that is not staged, and says what is', async () => {
    // Installing "the newest as a courtesy" would be the worst outcome: the request named a version.
    await expect(service.installVersion(identity, '9.9.9')).rejects.toThrow(/not staged/);
    await expect(service.installVersion(identity, '9.9.9')).rejects.toThrow(/0\.1\.31/);
    expect(installCalls).toHaveLength(0);
  });

  it('refuses an empty version', async () => {
    await expect(service.installVersion(identity, '   ')).rejects.toThrow(/No version/);
    expect(installCalls).toHaveLength(0);
  });

  it('refuses to swap CORE from here', async () => {
    const core = BuildSourceIdentity.parse(ExtensionScope.CORE, 'core') as BuildSourceIdentity;
    await expect(service.installVersion(core, '0.1.9')).rejects.toThrow(/Core cannot be switched/);
    expect(installCalls).toHaveLength(0);
  });

  it('ignores the source’s auto-install settings — an operator pressed a button', async () => {
    // `installAfterBuild` / `autoUpdate` decide whether a FRESH build may install itself. Consulting
    // them here would make the control silently do nothing on most sources, which have both off.
    service.db.findOne = vi.fn(async () => ({ version: '0.1.31', installAfterBuild: false, autoUpdate: false }));

    await service.installVersion(identity, '0.1.9');

    expect(installCalls).toHaveLength(1);
  });
});
