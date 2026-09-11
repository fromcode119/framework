import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BuiltPackageInstaller } from '@sources/packaging/built-package-installer';
import { BuildSourceType } from '@sources/sources/enums/build-source-type.enum';

/**
 * Which of the two settings allowed this install.
 *
 * They used to be one switch that ran only on the scheduled path, so pressing Build produced a
 * package and left it in the workspace. Separating them separates two different acts: putting a
 * package where none is installed, and REPLACING code that is currently serving a site.
 */
describe('BuiltPackageInstaller', () => {
  const STAGED = '/app/data/sources/themes/packages/fromcode-0.1.29';
  let service: any;
  let installer: any;
  let failures: Array<[string, string]>;

  const artifact = (over: Record<string, unknown> = {}) => ({
    stagedDir: STAGED,
    filePath: null,
    fileName: null,
    type: BuildSourceType.THEME,
    version: '0.1.29',
    artifactSha256: '',
    downloadPath: '/sources/fromcode/package',
    ...over,
  });

  beforeEach(() => {
    installer = {
      installExtensionDirectory: vi.fn(async () => undefined),
      installExtensionArchive: vi.fn(async () => undefined),
      isExtensionInstalled: vi.fn(async () => false),
    };
    failures = [];
    service = new BuiltPackageInstaller(installer, async (slug, message) => { failures.push([slug, message]); });
  });

  it('installs the staged DIRECTORY, never an archive', async () => {
    await service.install('fromcode', artifact(), { type: BuildSourceType.THEME });

    expect(installer.installExtensionDirectory).toHaveBeenCalledWith(STAGED, BuildSourceType.THEME, { enable: true });
    expect(installer.installExtensionArchive).not.toHaveBeenCalled();
  });

  it('never activates: a build must not change what a live site serves', async () => {
    await service.install('fromcode', artifact(), { type: BuildSourceType.THEME });

    const [, , options] = installer.installExtensionDirectory.mock.calls[0];
    expect(options.activate).toBeUndefined();
  });

  it('leaves a running extension alone when "update if already installed" is off', async () => {
    installer.isExtensionInstalled = vi.fn(async () => true);

    await service.install('fromcode', artifact(), { type: BuildSourceType.THEME, autoUpdate: false });

    expect(installer.installExtensionDirectory).not.toHaveBeenCalled();
  });

  it('replaces a running extension when that setting is on', async () => {
    installer.isExtensionInstalled = vi.fn(async () => true);

    await service.install('fromcode', artifact(), { type: BuildSourceType.THEME, autoUpdate: true });

    expect(installer.installExtensionDirectory).toHaveBeenCalledOnce();
  });

  it('reads the stored flag however the driver returned it', async () => {
    installer.isExtensionInstalled = vi.fn(async () => true);

    await service.install('fromcode', artifact(), { type: BuildSourceType.THEME, autoUpdate: 't' });

    expect(installer.installExtensionDirectory).toHaveBeenCalledOnce();
  });

  it('sends core to the archive installer, which is the one thing still packaged that way', async () => {
    const coreArtifact = artifact({
      type: BuildSourceType.CORE, stagedDir: null, filePath: '/app/data/sources/core/fromcode-core-1.0.0.zip',
    });

    await service.install('core', coreArtifact, { type: BuildSourceType.CORE });

    expect(installer.installExtensionArchive).toHaveBeenCalledOnce();
    expect(installer.installExtensionDirectory).not.toHaveBeenCalled();
  });

  it('records the failure against the source and does not throw, so the build still counts', async () => {
    installer.installExtensionDirectory = vi.fn(async () => { throw new Error('disk full'); });

    await expect(service.install('fromcode', artifact(), { type: BuildSourceType.THEME })).resolves.toBeUndefined();
    expect(failures).toHaveLength(1);
  });

  it('says so rather than guessing when a build recorded no package', async () => {
    await service.install('fromcode', artifact({ stagedDir: null }), { type: BuildSourceType.THEME });

    expect(installer.installExtensionDirectory).not.toHaveBeenCalled();
    expect(failures).toHaveLength(1);
  });
});
