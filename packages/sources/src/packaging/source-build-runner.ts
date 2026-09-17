import * as path from 'path';
import type { IBuildResult } from '@sources/packaging/interfaces/build-result.interface';
import { BuildErrorRedactionService } from '@sources/packaging/build-error-redaction-service';
import { BuildSourceIdentity } from '@sources/sources/build-source-identity';
import { BuiltPackageInstaller } from '@sources/packaging/built-package-installer';
import { ExtensionScope } from '@fromcode119/core';
import { GitUrlPolicy } from '@sources/providers/git/git-url-policy';
import { SourceProviders } from '@sources/providers/source-providers';
import type { IPackageBuiltEvent } from '@sources/packaging/interfaces/package-built-event.interface';
import type { ISourceProvider } from '@sources/providers/interfaces/source-provider.interface';
import { PackageBuilder } from '@sources/packaging/package-builder';

/**
 * Runs ONE build: fetch from the provider, pack it, record what happened, and announce it.
 *
 * The long, fallible half. Every step can fail against a remote, so the outcome is RECORDED on the
 * source row either way — a failed build must leave a readable reason on the row rather than only in
 * a log, because the screen that shows sources is the only place anyone looks.
 *
 * Split out of `BuildService`, which now decides WHICH sources to build and leaves the building here.
 */
export class SourceBuildRunner {
  constructor(
    private readonly db: any,
    private readonly logger: any,
    private readonly buildsSlug: string,
    private readonly packageBuilder: PackageBuilder,
    private readonly builtPackageInstaller: BuiltPackageInstaller,
    private readonly emitPackageBuilt: (event: IPackageBuiltEvent) => void,
    private readonly providerFor: (entry: { provider?: unknown }) => ISourceProvider | null,
    private readonly resolveSourceDirectory: (...args: any[]) => any,
    private readonly resolvePackageArtifact: (...args: any[]) => any,
  ) {}

  async buildOne(type: ExtensionScope, entry: any): Promise<IBuildResult> {
    const { slug, gitUrl, branch } = entry;
    const gitToken = entry.gitSecret;

    // A stored row is untrusted input. It may predate the transport allow-list, or have been written
    // through a path that skipped it, so the URL is re-asserted immediately before anything runs git.
    // Refusing here rather than inside GitSyncService means the refusal is recorded on the build row
    // and shown in the admin, instead of surfacing as an opaque git failure.
    try {
      GitUrlPolicy.assertAllowed(gitUrl);
    } catch (err: any) {
      const message = String(err?.message || err);
      await this.upsertBuildRecord(slug, type, gitUrl, branch, {
        last_build_at: new Date().toISOString(),
        last_build_status: 'failed',
        last_error: message,
      });
      return { slug, type, success: false, error: message };
    }

    this.logger.info(`Starting build pipeline for ${slug} (${branch})`);

    await this.upsertBuildRecord(slug, type, gitUrl, branch, { last_build_status: 'building', last_error: '' });

    try {
      const provider = this.providerFor(entry);
      if (!provider) {
        throw new Error(
          `"${slug}" is tracked with the provider "${SourceProviders.normalize(entry.provider)}", which this `
          + 'installation does not have. Nothing was fetched — building it with a different provider would '
          + 'fetch source the operator never pointed at.',
        );
      }
      const fetched = await provider.fetch({
        location: gitUrl, ref: branch, secret: gitToken, slug, kind: this.resolveSourceDirectory(type),
      });
      const sourceDir = fetched.directory;
      const commitSha = fetched.revision || 'unknown';
      // Read BEFORE building: what changed is the range between what was last built and what is
      // about to be, and the record still holds the previous revision at this point.
      const changelog = await provider.changesSince({ directory: sourceDir, previousRevision: String(entry.lastCommitSha || '') });
      const pkg = await this.packageBuilder.build(sourceDir, type);

      this.emitPackageBuilt({
        type,
        slug: pkg.slug,
        version: pkg.version,
        fileName: pkg.fileName,
        manifest: pkg.manifest,
        artifactSha256: pkg.artifactSha256,
      });
      await this.upsertBuildRecord(slug, type, gitUrl, branch, {
        last_commit_sha: commitSha,
        last_build_at: new Date().toISOString(),
        last_build_status: 'success',
        last_error: '',
        version: pkg.version,
        // A build stages a package directory and writes no archive, so any archive NAMED here
        // belongs to an earlier build of this source. Cleared rather than left: the filename carries
        // the version, a rebuild of the same version reuses it, and a stale row would hand a
        // download a package built before the commit that was just built. Core is the exception —
        // it produces an archive and nothing else.
        file_name: pkg.fileName ?? null,
        artifactSha256: pkg.artifactSha256 ?? null,
        changelog: changelog.join('\n'),
      });

      // Every successful build, manual or scheduled, offers itself to the installer. What happens
      // next is the source's own two settings; this is just the one place a build ends.
      if (BuiltPackageInstaller.readFlag(entry.installAfterBuild ?? entry.install_after_build)) {
        const identity = BuildSourceIdentity.parse(type, slug);
        await this.builtPackageInstaller.install(
          identity,
          await this.resolvePackageArtifact(identity),
          { ...entry, type, version: pkg.version },
        );
      }

      return { slug, type, success: true, version: pkg.version, fileName: pkg.fileName, changelog: changelog.join('\n') };
    } catch (err: any) {
      // git and npm routinely echo the remote URL and registry URLs, either of which can carry a
      // credential. This message is persisted AND rendered verbatim in the admin, so it is redacted
      // before it is stored or returned.
      const errorMsg = BuildErrorRedactionService.redact(err?.message || String(err));
      await this.upsertBuildRecord(slug, type, gitUrl, branch, {
        last_build_at: new Date().toISOString(),
        last_build_status: 'failed',
        last_error: errorMsg.substring(0, 2000),
      });
      return { slug, type, success: false, error: errorMsg };
    }
  }

  /**
   * Writes a build's progress onto its own row.
   *
   * The lookup carries the kind: by slug alone, building a theme found — and stamped its status,
   * version and error onto — a plugin that happened to share the name.
   */
  private async upsertBuildRecord(slug: string, type: ExtensionScope, gitUrl: string, branch: string, updates: Record<string, any>): Promise<void> {
    const existing = await this.db.findOne(this.buildsSlug, { slug, type: String(type.value) });
    if (existing) {
      await this.db.update(this.buildsSlug, { id: existing.id }, updates);
    } else {
      await this.db.insert(this.buildsSlug, { slug, type: type.value, git_url: gitUrl, branch, ...updates });
    }
  }
}
