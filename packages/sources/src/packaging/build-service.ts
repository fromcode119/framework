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
import { BuiltPackageService } from '@sources/packaging/built-package-service';
import { SourceRepositoryService } from '@sources/packaging/source-repository-service';
import { SourceBuildRunner } from '@sources/packaging/source-build-runner';

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
    this.builtPackages = new BuiltPackageService(
      db,
      this.logger,
      this.buildsSlug,
      packageBuilder,
      this.packageDownloads,
      installer,
    );
    this.repository = new SourceRepositoryService(providers, buildSourceService);
    this.builtPackageInstaller = new BuiltPackageInstaller(
      installer,
      (identity, message) => this.buildSourceService.recordAutoUpdateFailure(identity, message),
    );
    this.buildRunner = new SourceBuildRunner(
      db,
      this.logger,
      this.buildsSlug,
      packageBuilder,
      this.builtPackageInstaller,
      emitPackageBuilt,
      (entry) => this.providerFor(entry),
      (...args: any[]) => (this.resolveSourceDirectory as any)(...args),
      (...args: any[]) => (this.resolvePackageArtifact as any)(...args),
    );
  }

  private readonly builtPackageInstaller: BuiltPackageInstaller;
  private readonly packageDownloads: PackageDownloadService;
  private readonly builtPackages: BuiltPackageService;
  private readonly repository: SourceRepositoryService;
  private readonly buildRunner: SourceBuildRunner;

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

  /** @see BuiltPackageService.resolvePackageArtifact */
  resolvePackageArtifact(...args: Parameters<BuiltPackageService["resolvePackageArtifact"]>): ReturnType<BuiltPackageService["resolvePackageArtifact"]> {
    return this.builtPackages.resolvePackageArtifact(...args);
  }

  /** @see BuiltPackageService.listVersions */
  listVersions(...args: Parameters<BuiltPackageService["listVersions"]>): ReturnType<BuiltPackageService["listVersions"]> {
    return this.builtPackages.listVersions(...args);
  }

  /** @see BuiltPackageService.installVersion */
  installVersion(...args: Parameters<BuiltPackageService["installVersion"]>): ReturnType<BuiltPackageService["installVersion"]> {
    return this.builtPackages.installVersion(...args);
  }

  /** @see BuiltPackageService.resolveInstallablePackagePath */
  resolveInstallablePackagePath(...args: Parameters<BuiltPackageService["resolveInstallablePackagePath"]>): ReturnType<BuiltPackageService["resolveInstallablePackagePath"]> {
    return this.builtPackages.resolveInstallablePackagePath(...args);
  }

  /** @see BuiltPackageService.archivePackage */
  archivePackage(...args: Parameters<BuiltPackageService["archivePackage"]>): ReturnType<BuiltPackageService["archivePackage"]> {
    return this.builtPackages.archivePackage(...args);
  }

  /** @see BuiltPackageService.resolvePackageDownloadPath */
  resolvePackageDownloadPath(...args: Parameters<BuiltPackageService["resolvePackageDownloadPath"]>): ReturnType<BuiltPackageService["resolvePackageDownloadPath"]> {
    return this.builtPackages.resolvePackageDownloadPath(...args);
  }

  /** @see BuiltPackageService.resolvePackageFilePath */
  resolvePackageFilePath(...args: Parameters<BuiltPackageService["resolvePackageFilePath"]>): ReturnType<BuiltPackageService["resolvePackageFilePath"]> {
    return this.builtPackages.resolvePackageFilePath(...args);
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

  /** @see SourceBuildRunner.buildOne */
  private async buildOne(...args: Parameters<SourceBuildRunner["buildOne"]>): ReturnType<SourceBuildRunner["buildOne"]> {
    return this.buildRunner.buildOne(...args);
  }

  /**
   * The branches a remote has, for the form that asks which one to track.
   *
   * Goes through the same git service as every other remote call, so the URL allow-list applies
   * here too — this endpoint must not become a way to make the server contact arbitrary hosts.
   */
  /** @see SourceRepositoryService.resolveStoredToken */
  resolveStoredToken(...args: Parameters<SourceRepositoryService["resolveStoredToken"]>): ReturnType<SourceRepositoryService["resolveStoredToken"]> {
    return this.repository.resolveStoredToken(...args);
  }

  /** @see SourceRepositoryService.listBranches */
  listBranches(...args: Parameters<SourceRepositoryService["listBranches"]>): ReturnType<SourceRepositoryService["listBranches"]> {
    return this.repository.listBranches(...args);
  }

  /** @see SourceRepositoryService.inspectSource */
  inspectSource(...args: Parameters<SourceRepositoryService["inspectSource"]>): ReturnType<SourceRepositoryService["inspectSource"]> {
    return this.repository.inspectSource(...args);
  }

  /** @see SourceRepositoryService.resolveSourceDirectory */
  resolveSourceDirectory(...args: Parameters<SourceRepositoryService["resolveSourceDirectory"]>): ReturnType<SourceRepositoryService["resolveSourceDirectory"]> {
    return this.repository.resolveSourceDirectory(...args);
  }

}
