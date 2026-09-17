import { ExtensionScope } from '@fromcode119/core';
import { Logger } from '@fromcode119/core';
import { SourcesCollectionRegistry } from '@sources/sources/sources-tables';
import { BuildSourceSecretService } from '@sources/sources/build-source-secret-service';
import type { IBuildSourceInput } from '@sources/sources/interfaces/build-source-input.interface';
import type { IBuildSourceRecord } from '@sources/sources/interfaces/build-source-record.interface';
import type { IBuildSourceSummary } from '@sources/sources/interfaces/build-source-summary.interface';
import type { IBuildSourceUpdateInput } from '@sources/sources/interfaces/build-source-update-input.interface';
import { BuildSourceIdentity } from '@sources/sources/build-source-identity';
import { SourceProviders } from '@sources/providers/source-providers';
import { GitBranchPolicy } from '@sources/providers/git/git-branch-policy';
import { GitUrlPolicy } from '@sources/providers/git/git-url-policy';
import { BuildSourceMapper } from '@sources/sources/build-source-mapper';

export class BuildSourceService {
  private readonly buildsSlug = SourcesCollectionRegistry.BUILDS;
  private readonly logger = new Logger({ namespace: 'BuildSourceService' });

  private readonly mapper: BuildSourceMapper;

  constructor(
    private readonly db: any,
    private readonly secretService: BuildSourceSecretService
  ) {
    this.mapper = new BuildSourceMapper(secretService);
  }

  async createSource(input: IBuildSourceInput): Promise<IBuildSourceSummary> {
    const identity = BuildSourceIdentity.parse(input.type, input.slug);
    const existing = await this.db.findOne(this.buildsSlug, identity.where);
    if (existing) {
      // Names the KIND, because the slug on its own is not what collided: the operator may well
      // have a plugin by this name on purpose, and "already exists" without the kind reads as a
      // rule against that.
      throw new Error(`A ${String(identity.type.value)} source with slug "${identity.slug}" already exists.`);
    }

    const data = {
      autoBuild: Boolean(input.autoBuild),
      // Independent of automatic building. It used to be forced off unless `autoBuild` was on,
      // which read as "there would be nothing to install" — but a manual build produces a package
      // too, and tying the two meant pressing Build could never install anything.
      autoUpdate: Boolean(input.autoUpdate),
      // Defaults ON when the caller says nothing: a source is added to have its result arrive, and
      // a build that leaves its package in the workspace did half a job.
      installAfterBuild: input.installAfterBuild === undefined ? true : Boolean(input.installAfterBuild),
      branch: this.normalizeBranch(input.branch),
      git_secret: this.encryptSecret(input.gitSecret),
      git_url: this.normalizeGitUrl(input.gitUrl),
      last_build_status: 'pending',
      // Recorded, never implied. A source that does not say how it is fetched is a source only one
      // implementation can ever fetch.
      provider: SourceProviders.normalize(input.provider),
      slug: identity.slug,
      type: identity.type,
    };

    await this.db.insert(this.buildsSlug, data);
    const created = await this.db.findOne(this.buildsSlug, identity.where);
    if (!created) {
      throw new Error(`Failed to create build source "${identity.key}".`);
    }

    return this.sanitizeSource(created);
  }

  async deleteSource(identity: BuildSourceIdentity): Promise<void> {
    const existing = await this.db.findOne(this.buildsSlug, identity.where);
    if (existing) {
      await this.db.delete(this.buildsSlug, { id: existing.id });
    }
  }

  async encryptStoredSecrets(): Promise<number> {
    const sources = await this.db.find(this.buildsSlug);
    let updated = 0;

    for (const source of sources as IBuildSourceRecord[]) {
      const storedSecret = this.readStoredSecret(source);
      if (!storedSecret || this.secretService.isEncrypted(storedSecret)) {
        continue;
      }

      await this.db.update(this.buildsSlug, { id: source.id }, {
        git_secret: this.secretService.encrypt(storedSecret),
      });
      updated += 1;
    }

    if (updated > 0) {
      this.logger.info(`Encrypted ${updated} existing build source token(s).`);
    }

    return updated;
  }

  async getRawSource(identity: BuildSourceIdentity): Promise<IBuildSourceRecord | null> {
    const source = await this.db.findOne(this.buildsSlug, identity.where);
    if (!source) {
      return null;
    }

    return this.hydrateSource(source);
  }

  async getSanitizedSource(identity: BuildSourceIdentity): Promise<IBuildSourceSummary | null> {
    const source = await this.db.findOne(this.buildsSlug, identity.where);
    return source ? this.sanitizeSource(source) : null;
  }

  /**
   * Records why an automatic install did not happen.
   *
   * On the source, not in a log nobody reads: an operator who switched auto-update on and came back
   * to an unchanged site needs the reason where they made the choice.
   */
  async recordAutoUpdateFailure(identity: BuildSourceIdentity, message: string): Promise<void> {
    await this.db.update(this.buildsSlug, identity.where, {
      lastError: String(message || '').substring(0, 2000),
    });
  }

  /**
   * Records the archive that was just written for a build.
   *
   * Written when somebody downloads, not when the build runs: a build stages a package directory,
   * and a filename recorded for a file that does not exist is what sent an installer to the remote
   * marketplace looking for it.
   */
  async recordArchive(identity: BuildSourceIdentity, fileName: string, artifactSha256: string): Promise<void> {
    await this.db.update(this.buildsSlug, identity.where, { fileName, artifactSha256 });
  }

  async listRawSources(): Promise<IBuildSourceRecord[]> {
    const sources = await this.db.find(this.buildsSlug, { orderBy: { slug: 'ASC', type: 'ASC' } });
    return (sources as IBuildSourceRecord[]).map((source) => this.hydrateSource(source));
  }

  async listSanitizedSources(): Promise<IBuildSourceSummary[]> {
    const sources = await this.db.find(this.buildsSlug, { orderBy: { slug: 'ASC', type: 'ASC' } });
    return (sources as IBuildSourceRecord[]).map((source) => this.sanitizeSource(source));
  }

  async syncSources(inputs: IBuildSourceInput[]): Promise<IBuildSourceSummary[]> {
    const results: IBuildSourceSummary[] = [];

    for (const input of inputs) {
      // Every field is asserted here, NOT skipped. `sources:sync` is reachable from the hook bus as
      // well as the admin route, so a rejected entry must surface as an error the caller sees — a
      // silent `continue` would let a malformed source vanish with no signal.
      const identity = BuildSourceIdentity.parse(input.type, input.slug);
      const existing = await this.db.findOne(this.buildsSlug, identity.where);
      if (existing) {
        results.push(await this.updateSource(identity, {
          branch: this.normalizeBranch(input.branch),
          gitSecret: input.gitSecret,
          gitUrl: this.normalizeGitUrl(input.gitUrl),
        }));
        continue;
      }

      results.push(await this.createSource({
        branch: this.normalizeBranch(input.branch),
        gitSecret: input.gitSecret,
        gitUrl: this.normalizeGitUrl(input.gitUrl),
        slug: identity.slug,
        type: identity.type,
      }));
    }

    return results;
  }

  /**
   * Changes a source's settings. NOT its kind — that is half of which source this is.
   *
   * Editing the kind would move the clone directory, the staging root, the archive folder and the
   * installer it goes through: it is a different extension, so it is delete-and-recreate rather
   * than a field. `type` is gone from the input for that reason.
   */
  async updateSource(identity: BuildSourceIdentity, input: IBuildSourceUpdateInput): Promise<IBuildSourceSummary> {
    const existing = await this.db.findOne(this.buildsSlug, identity.where);
    if (!existing) {
      throw new Error(`Build source "${identity.key}" was not found.`);
    }

    const updates: Record<string, unknown> = {};

    if (typeof input.gitUrl === 'string') {
      updates.gitUrl = this.normalizeGitUrl(input.gitUrl);
    }

    if (typeof input.branch === 'string') {
      updates.branch = this.normalizeBranch(input.branch);
    }

    if (typeof input.gitSecret === 'string' && input.gitSecret.trim()) {
      updates.gitSecret = this.encryptSecret(input.gitSecret);
    }

    // Each switch stands alone. Turning automatic building off used to turn installing off with it,
    // which quietly discarded a choice the operator had made about a different question.
    if (typeof input.autoBuild === 'boolean') updates.autoBuild = input.autoBuild;
    if (typeof input.autoUpdate === 'boolean') updates.autoUpdate = input.autoUpdate;
    if (typeof input.installAfterBuild === 'boolean') updates.installAfterBuild = input.installAfterBuild;

    await this.db.update(this.buildsSlug, { id: existing.id }, updates);
    const refreshed = await this.db.findOne(this.buildsSlug, identity.where);
    if (!refreshed) {
      throw new Error(`Build source "${identity.key}" could not be reloaded after update.`);
    }

    return this.sanitizeSource(refreshed);
  }

  /** @see BuildSourceMapper.encryptSecret */
  encryptSecret(...args: Parameters<BuildSourceMapper["encryptSecret"]>): ReturnType<BuildSourceMapper["encryptSecret"]> {
    return this.mapper.encryptSecret(...args);
  }

  /** @see BuildSourceMapper.hydrateSource */
  hydrateSource(...args: Parameters<BuildSourceMapper["hydrateSource"]>): ReturnType<BuildSourceMapper["hydrateSource"]> {
    return this.mapper.hydrateSource(...args);
  }

  /** @see BuildSourceMapper.normalizeBranch */
  normalizeBranch(...args: Parameters<BuildSourceMapper["normalizeBranch"]>): ReturnType<BuildSourceMapper["normalizeBranch"]> {
    return this.mapper.normalizeBranch(...args);
  }

  /** @see BuildSourceMapper.normalizeGitUrl */
  normalizeGitUrl(...args: Parameters<BuildSourceMapper["normalizeGitUrl"]>): ReturnType<BuildSourceMapper["normalizeGitUrl"]> {
    return this.mapper.normalizeGitUrl(...args);
  }

  /** @see BuildSourceMapper.normalizeType */
  normalizeType(...args: Parameters<BuildSourceMapper["normalizeType"]>): ReturnType<BuildSourceMapper["normalizeType"]> {
    return this.mapper.normalizeType(...args);
  }

  /** @see BuildSourceMapper.readStoredSecret */
  readStoredSecret(...args: Parameters<BuildSourceMapper["readStoredSecret"]>): ReturnType<BuildSourceMapper["readStoredSecret"]> {
    return this.mapper.readStoredSecret(...args);
  }

  /** @see BuildSourceMapper.sanitizeSource */
  sanitizeSource(...args: Parameters<BuildSourceMapper["sanitizeSource"]>): ReturnType<BuildSourceMapper["sanitizeSource"]> {
    return this.mapper.sanitizeSource(...args);
  }

  /** @see BuildSourceMapper.normalizeSourceRecord */
  normalizeSourceRecord(...args: Parameters<BuildSourceMapper["normalizeSourceRecord"]>): ReturnType<BuildSourceMapper["normalizeSourceRecord"]> {
    return this.mapper.normalizeSourceRecord(...args);
  }

}
