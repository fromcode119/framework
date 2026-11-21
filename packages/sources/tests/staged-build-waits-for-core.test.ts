import { ExtensionScope } from '@fromcode119/core';
import { describe, expect, it, vi } from 'vitest';
import { BuildSourceIdentity } from '@sources/sources/build-source-identity';
import { BuiltPackageInstaller } from '@sources/packaging/built-package-installer';
import { StagedBuildOffer } from '@sources/packaging/staged-build-offer';

/**
 * A build the core cannot run yet must not sit staged forever: it says so on the source's row, the
 * installed version keeps running, and the first scheduled check after the core is updated installs it.
 * A version put back on purpose (no note on the row) is never replaced.
 */
describe('a staged build that waits for a newer core', () => {
  const identity = BuildSourceIdentity.parse(ExtensionScope.PLUGIN, 'guestbook');
  const tooOld = Object.assign(new Error('"guestbook" needs core >=0.2.700, but this installation runs 0.2.624.'), { code: 'CORE_TOO_OLD' });

  const setup = () => {
    const state = { lastError: '', installed: '0.1.0', coreIsNew: false };
    const installExtensionDirectory = vi.fn(async () => {
      if (!state.coreIsNew) throw tooOld;
      state.installed = '0.2.0';
    });
    const installer = { installExtensionDirectory, isExtensionInstalled: vi.fn(async () => true) };
    const record = async (_: BuildSourceIdentity, message: string) => { state.lastError = message; };
    const built = new BuiltPackageInstaller(installer as any, record);
    const offer = new StagedBuildOffer(
      async () => ({ lastBuildStatus: 'success', installAfterBuild: true, autoUpdate: true, lastError: state.lastError }),
      async () => ({ installed: state.installed, built: '0.2.0' }),
      async () => ({ stagedDir: '/staged/guestbook', filePath: null, fileName: null, downloadPath: '', artifactSha256: '', type: ExtensionScope.PLUGIN }),
      built,
      async () => { state.lastError = ''; },
    );
    return { state, built, offer, installExtensionDirectory };
  };
  const source = { slug: 'guestbook', autoUpdate: true };
  const artifact = { stagedDir: '/staged/guestbook', filePath: null, fileName: null, downloadPath: '', artifactSha256: '', type: ExtensionScope.PLUGIN } as any;

  it('says on the row that it waits, and does not count it as a failure', async () => {
    const { state, built } = setup();
    await built.install(identity, artifact, source);
    expect(state.lastError.startsWith(BuiltPackageInstaller.WAITING_FOR_CORE)).toBe(true);
    expect(state.installed).toBe('0.1.0');
  });

  it('keeps waiting while the core is old, then installs and clears the note once it is new', async () => {
    const { state, built, offer, installExtensionDirectory } = setup();
    await built.install(identity, artifact, source);

    await offer.offerWaiting(identity);
    expect(state.installed).toBe('0.1.0');
    expect(state.lastError.startsWith(BuiltPackageInstaller.WAITING_FOR_CORE)).toBe(true);

    state.coreIsNew = true;
    await offer.offerWaiting(identity);
    expect(state.installed).toBe('0.2.0');
    expect(state.lastError).toBe('');
    expect(installExtensionDirectory).toHaveBeenCalledTimes(3);
  });

  it('never replaces a version that was put back on purpose (no waiting note on the row)', async () => {
    const { state, offer, installExtensionDirectory } = setup();
    state.coreIsNew = true;
    await offer.offerWaiting(identity);
    expect(installExtensionDirectory).not.toHaveBeenCalled();
    expect(state.installed).toBe('0.1.0');
  });
});
