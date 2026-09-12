import { ExtensionScope } from '@fromcode119/core';
import { BuildSourceIdentity } from '@sources/sources/build-source-identity';
import type { ISourceProvider } from '@sources/providers/interfaces/source-provider.interface';
import { SourceProviders } from '@sources/providers/source-providers';
import { PackageBuilder } from '@sources/packaging/package-builder';
import { Logger } from '@fromcode119/core';
import type { IExtensionInstaller } from '@sources/interfaces/extension-installer.interface';
import { SourcesCollectionRegistry } from '@sources/sources/sources-tables';
import { BuildSourceService } from '@sources/sources/build-source-service';
import type { IBuildSourceInput } from '@sources/sources/interfaces/build-source-input.interface';
import type { IBuildResult } from '@sources/packaging/interfaces/build-result.interface';
import type { IPackageBuiltEvent } from '@sources/packaging/interfaces/package-built-event.interface';
import { CoercionUtils } from '@fromcode119/core';
import { GitUrlPolicy } from '@sources/providers/git/git-url-policy';
import { BuildErrorRedactionService } from '@sources/packaging/build-error-redaction-service';
import { BuiltPackageInstaller } from '@sources/packaging/built-package-installer';
import { PackageDownloadService } from '@sources/packaging/package-download-service';
import type { IBuiltPackageArtifact } from '@sources/packaging/interfaces/built-package-artifact.interface';
import { PackageArchiver } from '@sources/packaging/package-archiver';
import { ArtifactDigestService } from '@sources/packaging/artifact-digest-service';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Orchestrates the full build pipeline: read from DB → git sync →
 * package → update DB records.
 */
export class BuildService {
  private building = false;
  private readonly buildsSlug = SourcesCollectionRegistry.BUILDS;
  private readonly logger = new Logger({ namespace: 'BuildService' });

  constructor(
    private db: any,
    // Resolves the provider a source is tracked with. Not a GitSyncService: git is one provider,
    // and it was only ever the default because it was the only one.
    private providers: (key: string) => ISourceProvider | null,
    private packageBuilder: PackageBuilder,
    private buildSourceService: BuildSourceService,
    // Announce a freshly built package on the hook bus; listeners (e.g. the marketplace) persist it.
    private readonly emitPackageBuilt: (event: IPackageBuiltEvent) => void,
    // Auto-update installs what it just built. Injected rather than reached through a context, so
    // this package states its dependency instead of asking a sandbox for permission.
    private readonly installer?: IExtensionInstaller,
  ) {
    this.packageDownloads = new PackageDownloadService(
      packageBuilder,
      (identity, fileName, digest) => this.buildSourceService.recordArchive(identity, fileName, digest),
    );
    this.builtPackageInstaller = new BuiltPackageInstaller(
      installer,
      (identity, message) => this.buildSourceService.recordAutoUpdateFailure(identity, message),
    );
  }

  private readonly builtPackageInstaller: BuiltPackageInstaller;
  private readonly packageDownloads: PackageDownloadService;

  /** The provider a row names, or null when this installation does not have it. */
  private providerFor(entry: { provider?: unknown }): ISourceProvider | null {
    return this.providers(SourceProviders.normalize(entry?.provider));
  }

  async buildAll(): Promise<IBuildResult[]> {
    if (this.building) return [];

    this.building = true;
    const results: IBuildResult[] = [];

    try {
      const sources = await this.buildSourceService.listRawSources();

      for (const entry of sources) {
        results.push(await this.buildOne(entry.type, entry));
      }
    } finally {
      this.building = false;
    }

    return results;
  }

  async buildSource(identity: BuildSourceIdentity): Promise<IBuildResult> {
    const entry = await this.buildSourceService.getRawSource(identity);
    if (!entry) {
      return {
        slug: identity.slug,
        type: identity.type,
        success: false,
        error: `"${identity.key}" not found in database.`,
      };
    }
    return this.buildOne(identity.type, entry);
  }

  async checkForUpdates(): Promise<{ slug: string; type: string; hasUpdate: boolean; remoteSha: string | null }[]> {
    const sources = await this.buildSourceService.listRawSources();
    const results: { slug: string; type: string; hasUpdate: boolean; remoteSha: string | null }[] = [];

    for (const entry of sources) {
      this.logger.debug(`Checking updates for ${entry.slug}`);
      const provider = this.providerFor(entry);
      const remoteSha = provider
        ? await provider.headRevision({ location: entry.gitUrl, ref: entry.branch || 'main', secret: entry.gitSecret || undefined })
        : null;
      const hasUpdate = !entry.lastCommitSha || entry.lastCommitSha !== remoteSha;
      this.logger.debug(`Update status for ${entry.slug}: hasUpdate=${hasUpdate}, remoteSha=${remoteSha}`);
      results.push({ slug: entry.slug, type: ExtensionScope.resolve(entry.type).value, hasUpdate, remoteSha });
    }

    return results;
  }

  /**
   * Build the sources whose branch moved AND whose operator asked for it.
   *
   * Opted in per source, never globally: this compiles code from a repository, and somebody tracking
   * a source to watch it must not have it built behind their back. A source with the switch off is
   * still CHECKED — the new version shows up in the catalogue as available — it simply is not built
   * without being asked.
   */
  async checkAndBuildUpdates(): Promise<IBuildResult[]> {
    const updates = await this.checkForUpdates();
    const changed = updates.filter(u => u.hasUpdate);
    if (changed.length === 0) return [];

    const sources = await this.buildSourceService.listSanitizedSources();
    // Keyed on the PAIR. Keyed on the slug alone, a theme and a plugin sharing a name collapsed to
    // one entry, so whichever came second decided whether BOTH were built automatically.
    const wanted = new Map(sources.map((row: any) => [`${String(row.type)}/${String(row.slug)}`, row]));

    const results: IBuildResult[] = [];
    for (const update of changed) {
      const identity = BuildSourceIdentity.parse(update.type, update.slug);
      const source = wanted.get(identity.key);
      if (!source?.autoBuild) continue;

      const result = await this.buildSource(identity);
      results.push(result);
    }
    return results;
  }

  /** A stored boolean, however the driver returned it. */
  private static readFlag(value: unknown): boolean {
    return value === true || value === 1 || value === 't' || value === 'true';
  }

  async getStatus(): Promise<any[]> {
    const results = await this.buildSourceService.listSanitizedSources();
    this.logger.debug(`getStatus: results count=${results.length}, first entry keys: ${Object.keys(results[0] || {})}`);
    return results;
  }

  /** ONE source's status. `getStatus()` above lists them all — different question, different name. */
  async getSourceStatus(identity: BuildSourceIdentity): Promise<any | null> {
    return this.buildSourceService.getSanitizedSource(identity);
  }

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

  /** The built package as a downloadable archive, made on request. See PackageDownloadService. */
  async archivePackage(identity: BuildSourceIdentity): Promise<{ filePath: string; fileName: string } | null> {
    return this.packageDownloads.archive(identity, await this.resolvePackageArtifact(identity));
  }

  async createSource(input: any): Promise<any> {
    return this.buildSourceService.createSource(input);
  }

  async syncSources(inputs: IBuildSourceInput[]): Promise<any[]> {
    return this.buildSourceService.syncSources(inputs);
  }

  async deleteSource(identity: BuildSourceIdentity): Promise<void> {
    await this.buildSourceService.deleteSource(identity);
  }

  async updateSource(identity: BuildSourceIdentity, input: any): Promise<any> {
    return this.buildSourceService.updateSource(identity, input);
  }

  private async buildOne(type: ExtensionScope, entry: any): Promise<IBuildResult> {
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

  /**
   * The branches a remote has, for the form that asks which one to track.
   *
   * Goes through the same git service as every other remote call, so the URL allow-list applies
   * here too — this endpoint must not become a way to make the server contact arbitrary hosts.
   */
  /**
   * The token stored against an existing source, for a form that is EDITING one.
   *
   * The stored secret is never sent to the browser, so the edit dialog posts a blank token. Without
   * this, reading a private repository's branches failed for want of credentials the server already
   * had, and the field said "No branches could be read" — a statement about the repository for what
   * was really a statement about the request.
   *
   * The token is released ONLY for the repository it was stored against. A caller chooses both the
   * slug and the URL, so without that check "read the branches of <attacker's host>, as source
   * <yours>" would hand somebody else's host a working credential — the stored secret would leave
   * the server after all, just not through the field that refuses to show it.
   */
  async resolveStoredToken(identity: BuildSourceIdentity, gitUrl: string): Promise<string | undefined> {
    const entry = await this.buildSourceService.getRawSource(identity);
    if (!entry?.gitSecret) return undefined;
    return BuildService.sameRepository(entry.gitUrl, gitUrl) ? entry.gitSecret : undefined;
  }

  /**
   * Whether two URLs name the same repository, for the purpose of releasing a credential.
   *
   * Deliberately strict: case and a trailing slash or `.git` are noise git itself ignores, and
   * nothing else is forgiven. A looser comparison here is a credential leak, so anything it cannot
   * prove identical is treated as a different repository.
   */
  private static sameRepository(stored: string, requested: string): boolean {
    // Trailing slashes come off FIRST: "repo.git/" must reach "repo", and stripping `.git` before
    // the slash leaves "repo.git", which then matches nothing.
    const normalize = (value: string): string =>
      String(value || '').trim().toLowerCase().replace(/\/+$/, '').replace(/\.git$/, '').replace(/\/+$/, '');
    const left = normalize(stored);
    return left.length > 0 && left === normalize(requested);
  }

  async listBranches(gitUrl: string, token?: string): Promise<string[]> {
    const provider = this.providers(SourceProviders.defaultKey());
    return provider ? provider.listRefs({ location: gitUrl, secret: token }) : [];
  }

  /** What the repository declares itself to be — slug and type — so the form never asks for them. */
  async inspectSource(gitUrl: string, branch: string, token?: string): Promise<Record<string, unknown> | null> {
    const provider = this.providers(SourceProviders.defaultKey());
    return provider ? provider.inspect({ location: gitUrl, ref: branch, secret: token }) : null;
  }

  private resolveSourceDirectory(type: ExtensionScope): string {
    if (type === ExtensionScope.CORE) {
      return 'core';
    }
    if (type === ExtensionScope.APPEARANCE) {
      return 'appearances';
    }
    return type === ExtensionScope.THEME ? 'themes' : 'plugins';
  }
}
