import { ExtensionScope } from '@fromcode119/core';
import { BuildErrorRedactionService } from '@sources/packaging/build-error-redaction-service';
import { Logger } from '@fromcode119/core';
import type { IBuiltPackageArtifact } from '@sources/packaging/interfaces/built-package-artifact.interface';
import type { IExtensionInstaller } from '@sources/interfaces/extension-installer.interface';

/**
 * What happens to a package after it is built.
 *
 * This used to run only on the scheduled path, so pressing Build produced a package and left it in
 * the workspace — the button did half a job and nothing said which half. It now runs after EVERY
 * successful build, and the source's own settings decide what that means.
 *
 * Two settings, because two different acts hide here. Putting a package where none is installed is
 * additive, and is what "install after build" allows. REPLACING code that is currently serving a
 * site is not, and needs its own consent: "update if already installed". Neither depends on
 * automatic building any more — a manual build is still a build.
 */
export class BuiltPackageInstaller {
  private readonly logger = new Logger({ namespace: 'sources:install' });

  constructor(
    private readonly installer: IExtensionInstaller | undefined,
    private readonly recordFailure: (slug: string, message: string) => Promise<void>,
  ) {}

  /**
   * Installs the built package if the source's settings allow it.
   *
   * A failure is recorded against the source and never rethrown: the build itself succeeded, and
   * losing that fact would make the next check rebuild the same commit forever.
   */
  async install(slug: string, artifact: IBuiltPackageArtifact | null, source: Record<string, any>): Promise<void> {
    try {
      if (!this.installer) {
        this.logger.warn(`Install skipped for ${slug}: no installer is wired.`);
        return;
      }
      if (!artifact) {
        this.logger.warn(`Install skipped for ${slug}: no build was recorded.`);
        return;
      }

      const type = ExtensionScope.resolve(source.type);
      const installed = await this.installer.isExtensionInstalled(slug, type as never);
      if (installed && !BuiltPackageInstaller.readFlag(source.autoUpdate)) {
        this.logger.info(
          `"${slug}" is already installed and "Update if already installed" is off — the new build `
          + 'was staged and nothing running was replaced.',
        );
        return;
      }

      await this.place(artifact, type);
      this.logger.info(
        `${installed ? 'Updated' : 'Installed'} ${slug} ${source.version ? `to ${source.version}` : 'from the new build'}.`,
      );
    } catch (err: any) {
      const message = BuildErrorRedactionService.redact(err?.message || String(err));
      this.logger.error(`Install failed for ${slug}: ${message}`);
      await this.recordFailure(slug, message).catch(() => undefined);
    }
  }

  /**
   * Hands the package to the installer, as the directory it is.
   *
   * Core is the one exception and keeps its archive: it replaces the live project root, a different
   * operation with different risks.
   *
   * `activate` is deliberately absent. A theme that installs itself must not change what a live site
   * serves — activation is its own press, in the admin, by someone who meant it. The previous
   * auto-update passed `activate: true`, so a scheduled build could swap a running site's theme.
   */
  private async place(artifact: IBuiltPackageArtifact, type: ExtensionScope): Promise<void> {
    if (type === ExtensionScope.CORE) {
      if (!artifact.filePath) throw new Error('The core build produced no archive.');
      await this.installer!.installExtensionArchive(artifact.filePath, type as never, { enable: true });
      return;
    }

    if (!artifact.stagedDir) throw new Error('The build recorded no package directory.');
    await this.installer!.installExtensionDirectory(artifact.stagedDir, type as never, { enable: true });
  }

  /** A stored boolean, however the driver returned it. */
  static readFlag(value: unknown): boolean {
    return value === true || value === 1 || value === 't' || value === 'true';
  }
}
