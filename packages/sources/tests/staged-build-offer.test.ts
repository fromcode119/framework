import { ExtensionScope } from '@fromcode119/core';
import { describe, expect, it, vi } from 'vitest';
import { BuildSourceIdentity } from '@sources/sources/build-source-identity';
import { BuiltPackageInstaller } from '@sources/packaging/built-package-installer';
import { StagedBuildOffer } from '@sources/packaging/staged-build-offer';

/**
 * A build made while an install switch was off was staged and never offered again, so turning the switch
 * on later applied to nothing until the source's next commit (finance-payment-stripe 0.1.3 sat built but
 * uninstalled with both switches on). Turning a switch on now offers the waiting build, once.
 */
describe('a build waiting when an install switch is turned on', () => {
  const identity = BuildSourceIdentity.parse(ExtensionScope.PLUGIN, 'stripe');
  const stagedDir = '/app/data/sources/plugins/packages/stripe-0.1.3';

  const offer = (over: { source?: Record<string, unknown>; installed?: string | null; built?: string | null; running?: boolean } = {}) => {
    const installer = {
      installExtensionDirectory: vi.fn(async () => undefined),
      installExtensionArchive: vi.fn(async () => undefined),
      isExtensionInstalled: vi.fn(async () => over.running ?? true),
    };
    const source = { lastBuildStatus: 'success', installAfterBuild: true, autoUpdate: true, ...over.source };
    const service = new StagedBuildOffer(
      async () => source,
      async () => ({ installed: over.installed === undefined ? '0.1.2' : over.installed, built: over.built === undefined ? '0.1.3' : over.built }),
      async () => ({ stagedDir, filePath: null, fileName: null, downloadPath: '', artifactSha256: '', type: ExtensionScope.PLUGIN }),
      new BuiltPackageInstaller(installer as any, async () => undefined),
    );
    return { service, installer };
  };
  const off = { autoUpdate: false, installAfterBuild: false };

  it('installs a newer build when "update if already installed" is turned on', async () => {
    const { service, installer } = offer();
    await service.afterSettingsSaved(identity, off, { autoUpdate: true });
    expect(installer.installExtensionDirectory).toHaveBeenCalledWith(stagedDir, ExtensionScope.PLUGIN, { enable: true });
  });

  it('installs a build where none is installed when "install after build" is turned on', async () => {
    const { service, installer } = offer({ installed: null, running: false, source: { autoUpdate: false } });
    await service.afterSettingsSaved(identity, off, { installAfterBuild: true });
    expect(installer.installExtensionDirectory).toHaveBeenCalledOnce();
  });

  it('still honours the source\'s own switches: no replacing running code while "update" is off', async () => {
    const { service, installer } = offer({ source: { autoUpdate: false } });
    await service.afterSettingsSaved(identity, off, { installAfterBuild: true });
    expect(installer.installExtensionDirectory).not.toHaveBeenCalled();
  });

  it('does nothing when a switch is saved without being turned on, so a deliberate rollback stays', async () => {
    const { service, installer } = offer();
    await service.afterSettingsSaved(identity, { autoUpdate: true, installAfterBuild: true }, { autoUpdate: true, autoBuild: false });
    await service.afterSettingsSaved(identity, { auto_update: 't', install_after_build: 't' }, { autoUpdate: true });
    await service.afterSettingsSaved(identity, { autoUpdate: true }, { autoUpdate: false });
    expect(installer.installExtensionDirectory).not.toHaveBeenCalled();
  });

  it('offers only a build newer than what runs, and only a build that succeeded', async () => {
    for (const case_ of [{ installed: '0.1.3' }, { installed: '0.1.10', built: '0.1.9' }, { built: null }, { source: { lastBuildStatus: 'failed' } }]) {
      const { service, installer } = offer(case_);
      await service.afterSettingsSaved(identity, off, { autoUpdate: true });
      expect(installer.installExtensionDirectory).not.toHaveBeenCalled();
    }
  });

  it('compares versions as numbers, part by part', () => {
    expect(StagedBuildOffer.isNewer('0.1.10', '0.1.9')).toBe(true);
    expect(StagedBuildOffer.isNewer('0.2.0', '0.1.99')).toBe(true);
    expect(StagedBuildOffer.isNewer('0.1.3', '0.1.3')).toBe(false);
    expect(StagedBuildOffer.isNewer('1.0.0-beta', '0.9.0')).toBe(false);
  });
});
