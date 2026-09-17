import type { IBuiltPackageArtifact } from '@sources/packaging/interfaces/built-package-artifact.interface';
import { BuildSourceIdentity } from '@sources/sources/build-source-identity';
import { BuiltPackageInstaller } from '@sources/packaging/built-package-installer';
import { CoercionUtils } from '@fromcode119/core';
import { ExtensionScope } from '@fromcode119/core';
import { PackageDownloadService } from '@sources/packaging/package-download-service';
import * as fs from 'fs';
import * as path from 'path';
import type { IExtensionInstaller } from '@sources/interfaces/extension-installer.interface';
import { PackageBuilder } from '@sources/packaging/package-builder';

/**
 * Everything about a package that has already been BUILT: finding it on disk, listing its versions,
 * installing one, handing it out as a download.
 *
 * Separated from building because the two fail differently and are asked for at different times. A
 * build is a long, fallible operation against a remote repository; this is a lookup against what
 * that produced, and its answers are `null` — "not built yet" is an ordinary state, not an error.
 *
 * Split out of `BuildService` (494 lines), which now does one thing: turn a tracked source into a
 * package. What happens to the package afterwards lives here.
 */
export class BuiltPackageService {
  constructor(
    private readonly db: any,
    private readonly logger: any,
    private readonly buildsSlug: string,
    private readonly packageBuilder: PackageBuilder,
    private readonly packageDownloads: PackageDownloadService,
    private readonly installer?: IExtensionInstaller,
  ) {}

  async resolvePackageDownloadPath(identity: BuildSourceIdentity): Promise<string | null> {
    const artifact = await this.resolvePackageArtifact(identity);
    return artifact?.downloadPath || null;
  }

  /**
   * Where a built package IS, for something about to open it.
   *
   * Deliberately separate from `resolvePackageDownloadPath`: that one answers with the route a
   * browser would fetch, and the two were confused once already — an installer opened `/themes/x.zip`
   * as a file and failed with EACCES on a directory it had no business writing to.
   */
  async resolvePackageFilePath(identity: BuildSourceIdentity): Promise<string | null> {
    const artifact = await this.resolvePackageArtifact(identity);
    return artifact?.filePath || null;
  }

  /**
   * Everything known about a built package: where it is staged, and where a download would come from.
   *
   * Keyed on the recorded VERSION rather than a filename, because a build no longer produces a file
   * — it produces a staged directory whose location the builder owns. The archive exists only once
   * somebody has asked to download it.
   */
  async resolvePackageArtifact(identity: BuildSourceIdentity): Promise<IBuiltPackageArtifact | null> {
    const entry = await this.db.findOne(this.buildsSlug, identity.where);
    if (!entry) {
      return null;
    }

    const resolvedType = identity.type;
    const version = CoercionUtils.toString(entry.version).trim();
    const fileName = CoercionUtils.toString(entry.file_name ?? entry.fileName).trim() || null;

    return {
      // The digest recorded when an archive was last written. An installer that fetches the archive
      // MUST re-hash it and compare — it is the only value in the exchange that did not travel
      // inside the package. Empty means no archive has been written, and a caller must refuse
      // rather than assume.
      artifactSha256: CoercionUtils.toString(entry.artifactSha256),
      // The route that produces a download. It zips the staged package on request; nothing serves a
      // file that may not exist.
      downloadPath: `/sources/${String(identity.type.value)}/${identity.slug}/package`,
      // The package itself. Asked of the builder rather than rebuilt from the kind's name: joining
      // `/themes/<file>` onto the process's cwd once named `/app/themes/<file>` for an archive that
      // lives in the WORKSPACE. Null when no successful build has recorded a version.
      stagedDir: version ? this.packageBuilder.stagingDirFor(resolvedType, identity.slug, version) : null,
      // The archive, if one has been written. Core only ever has this.
      filePath: fileName ? path.join(this.packageBuilder.outputDirFor(resolvedType), fileName) : null,
      fileName,
      type: resolvedType,
      version: version || undefined,
    };
  }

  /**
   * What is RUNNING, what was last BUILT, and everything still installable.
   *
   * Three different facts that the screen used to collapse into one. A source reported the version it
   * last built and nothing else, so an installation could report "built 0.1.31" for weeks while
   * 0.1.20 served every request — the two are recorded in different places and nothing compared them.
   *
   * `available` is read from disk rather than from any record: a build clears its own version's
   * staging directory and leaves every other, so the versions this installation can still put in
   * place are simply the ones that are still there.
   */
  async listVersions(identity: BuildSourceIdentity): Promise<{
    installed: string | null;
    built: string | null;
    available: string[];
  }> {
    const entry = await this.db.findOne(this.buildsSlug, identity.where);
    const built = CoercionUtils.toString(entry?.version).trim() || null;
    const installed = this.installer
      ? await this.installer.installedExtensionVersion(identity.slug, identity.type)
      : null;

    return {
      installed,
      built,
      available: this.packageBuilder.listStagedVersions(identity.type, identity.slug),
    };
  }

  /**
   * Puts a SPECIFIC staged version in place — the way back to an older build.
   *
   * Deliberately not routed through `BuiltPackageInstaller`: that one exists to decide whether a
   * FRESH build may install itself, and answers to `installAfterBuild` and `autoUpdate`. This is an
   * operator pressing a button about a version that already exists, so those two settings have
   * nothing to say about it — consulting them would make the control silently do nothing on a source
   * configured not to auto-install, which is most of them.
   *
   * Refuses a version it cannot find on disk rather than installing the newest as a courtesy: the
   * request named a version, and quietly installing a different one is the worst outcome available.
   */
  async installVersion(identity: BuildSourceIdentity, version: string): Promise<{ installed: string }> {
    const wanted = CoercionUtils.toString(version).trim();
    if (!wanted) throw new Error('No version was given.');
    if (!this.installer) throw new Error('No installer is wired; this deployment cannot install packages.');
    if (identity.type === ExtensionScope.CORE) {
      // Core replaces the running project root. Whatever swapping its version means, it is not this
      // button, and answering the request would be worse than refusing it.
      throw new Error('Core cannot be switched to another version from here.');
    }

    const available = this.packageBuilder.listStagedVersions(identity.type, identity.slug);
    if (!available.includes(wanted)) {
      throw new Error(`Version "${wanted}" is not staged for ${identity.key}. Available: ${available.join(', ') || 'none'}.`);
    }

    const stagedDir = this.packageBuilder.stagingDirFor(identity.type, identity.slug, wanted);
    // `activate: false` — installing a theme is not choosing it. Putting a version back must not also
    // switch the site onto it; that is a separate decision the operator makes on the Themes screen.
    await this.installer.installExtensionDirectory(stagedDir, identity.type, { activate: false });
    this.logger.info(`Installed ${identity.key} version ${wanted} from ${stagedDir}.`);

    return { installed: wanted };
  }

  /**
   * The built package as something an installer can OPEN — an archive when one was written, the staged
   * directory otherwise.
   *
   * `resolvePackageFilePath` answers only with the archive, and a build no longer writes one: it stages
   * a directory and the zip is produced when somebody presses Download. So on any installation where
   * nobody had downloaded a package, that method answered null for every source, the catalogue reported
   * "offered by this installation but its package could not be found", and the admin's Update button
   * failed for every locally built plugin. Measured on production: `file_name` was empty for all 20.
   *
   * The staged directory is a first-class answer rather than a consolation — the installer already
   * branches on `isDirectory()` and installs one directly. Existence is checked here so that a missing
   * package is reported as missing, instead of throwing `ENOENT` inside the caller's `statSync`.
   */
  async resolveInstallablePackagePath(identity: BuildSourceIdentity): Promise<string | null> {
    const artifact = await this.resolvePackageArtifact(identity);
    if (!artifact) return null;

    for (const candidate of [artifact.filePath, artifact.stagedDir]) {
      if (candidate && fs.existsSync(candidate)) return candidate;
    }
    return null;
  }

  /** The built package as a downloadable archive, made on request. See PackageDownloadService. */
  async archivePackage(identity: BuildSourceIdentity): Promise<{ filePath: string; fileName: string } | null> {
    return this.packageDownloads.archive(identity, await this.resolvePackageArtifact(identity));
  }
}
