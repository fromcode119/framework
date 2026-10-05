import { CoercionUtils } from '@fromcode119/core';
import { BuildSourceIdentity } from '@sources/sources/build-source-identity';
import { BuiltPackageInstaller } from '@sources/packaging/built-package-installer';
import type { IBuiltPackageArtifact } from '@sources/packaging/interfaces/built-package-artifact.interface';

/**
 * Offers a build that already exists to the installer when the operator turns an install switch ON.
 *
 * An install is offered only at the end of a FRESH build, so a build made while "Install after build" or
 * "Update if already installed" was off was staged and never offered again: the scheduled check sees no
 * new commit, rebuilds nothing, and the switch the operator turned on afterwards applied to nothing until
 * the source's next commit. Turning a switch on is the consent to replace running code, so that is the
 * moment the waiting build is offered — once. It is not repeated on every check, so a version the
 * operator put back on purpose (a rollback) is not replaced again behind their back.
 *
 * Only a build NEWER than what runs is offered; the installer still applies the source's own two
 * switches (install where none is, replace only when "Update if already installed" is on).
 */
export class StagedBuildOffer {
  constructor(
    private readonly rawSource: (identity: BuildSourceIdentity) => Promise<Record<string, any> | null>,
    private readonly versions: (identity: BuildSourceIdentity) => Promise<{ installed: string | null; built: string | null }>,
    private readonly artifact: (identity: BuildSourceIdentity) => Promise<IBuiltPackageArtifact | null>,
    private readonly installer: BuiltPackageInstaller,
  ) {}

  /** @param before the source as it was stored before the settings were saved. */
  async afterSettingsSaved(identity: BuildSourceIdentity, before: Record<string, any> | null, input: Record<string, any>): Promise<void> {
    if (!StagedBuildOffer.turnedOn(before, input)) return;
    const source = await this.rawSource(identity);
    if (!source || CoercionUtils.toString(source.lastBuildStatus ?? source.last_build_status) !== 'success') return;
    if (!BuiltPackageInstaller.readFlag(source.installAfterBuild ?? source.install_after_build)) return;

    const { installed, built } = await this.versions(identity);
    if (!built || (installed && !StagedBuildOffer.isNewer(built, installed))) return;
    await this.installer.install(identity, await this.artifact(identity), { ...source, type: identity.type, version: built });
  }

  private static turnedOn(before: Record<string, any> | null, input: Record<string, any>): boolean {
    const was = (name: string, column: string) => BuiltPackageInstaller.readFlag(before?.[name] ?? before?.[column]);
    return (input.autoUpdate === true && !was('autoUpdate', 'auto_update'))
      || (input.installAfterBuild === true && !was('installAfterBuild', 'install_after_build'));
  }

  /** Dotted numeric versions, compared part by part; a version that is not numeric is never "newer". */
  static isNewer(candidate: string, current: string): boolean {
    const parts = (version: string) => version.split('.').map((part) => Number(part));
    const a = parts(candidate);
    const b = parts(current);
    if ([...a, ...b].some((part) => !Number.isInteger(part))) return false;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const difference = (a[i] ?? 0) - (b[i] ?? 0);
      if (difference !== 0) return difference > 0;
    }
    return false;
  }
}
