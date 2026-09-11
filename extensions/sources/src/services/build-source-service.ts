import { Logger } from '@fromcode119/sdk/server';
import { SourcesCollectionRegistry } from '@plugin/src/services/sources-collection-registry';
import { BuildSourceSecretService } from '@plugin/src/services/build-source-secret-service';
import type { IBuildSourceInput } from '@plugin/src/services/interfaces/build-source-input.interface';
import type { IBuildSourceRecord } from '@plugin/src/services/interfaces/build-source-record.interface';
import type { IBuildSourceSummary } from '@plugin/src/services/interfaces/build-source-summary.interface';
import type { IBuildSourceUpdateInput } from '@plugin/src/services/interfaces/build-source-update-input.interface';
import { BuildSourceType } from '@plugin/src/services/enums/build-source-type.enum';
import { BuildSlugPolicy } from '@plugin/src/services/build-slug-policy';
import { GitBranchPolicy } from '@plugin/src/services/git-branch-policy';
import { GitUrlPolicy } from '@plugin/src/services/git-url-policy';

export class BuildSourceService {
  private readonly buildsSlug = SourcesCollectionRegistry.BUILDS;
  private readonly logger = new Logger({ namespace: 'BuildSourceService' });

  constructor(
    private readonly db: any,
    private readonly secretService: BuildSourceSecretService
  ) {}

  async createSource(input: IBuildSourceInput): Promise<IBuildSourceSummary> {
    const slug = this.normalizeSlug(input.slug);
    const existing = await this.db.findOne(this.buildsSlug, { slug });
    if (existing) {
      throw new Error(`A build source with slug "${slug}" already exists.`);
    }

    const data = {
      // Installing cannot be on without building: there would be nothing to install. Asserted here
      // rather than trusted from the caller, because the API is reachable from the hook bus too.
      autoBuild: Boolean(input.autoBuild),
      autoUpdate: Boolean(input.autoBuild) && Boolean(input.autoUpdate),
      branch: this.normalizeBranch(input.branch),
      git_secret: this.encryptSecret(input.gitSecret),
      git_url: this.normalizeGitUrl(input.gitUrl),
      last_build_status: 'pending',
      slug,
      type: this.normalizeType(input.type),
    };

    await this.db.insert(this.buildsSlug, data);
    const created = await this.db.findOne(this.buildsSlug, { slug });
    if (!created) {
      throw new Error(`Failed to create build source "${slug}".`);
    }

    return this.sanitizeSource(created);
  }

  async deleteSource(slug: string): Promise<void> {
    const existing = await this.db.findOne(this.buildsSlug, { slug });
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

  async getRawSourceBySlug(slug: string): Promise<IBuildSourceRecord | null> {
    const source = await this.db.findOne(this.buildsSlug, { slug });
    if (!source) {
      return null;
    }

    return this.hydrateSource(source);
  }

  async getSanitizedSourceBySlug(slug: string): Promise<IBuildSourceSummary | null> {
    const source = await this.db.findOne(this.buildsSlug, { slug });
    return source ? this.sanitizeSource(source) : null;
  }

  /**
   * Records why an automatic install did not happen.
   *
   * On the source, not in a log nobody reads: an operator who switched auto-update on and came back
   * to an unchanged site needs the reason where they made the choice.
   */
  async recordAutoUpdateFailure(slug: string, message: string): Promise<void> {
    await this.db.update(this.buildsSlug, { slug: this.normalizeSlug(slug) }, {
      lastError: String(message || '').substring(0, 2000),
    });
  }

  async listRawSources(): Promise<IBuildSourceRecord[]> {
    const sources = await this.db.find(this.buildsSlug, { orderBy: { slug: 'ASC' } });
    return (sources as IBuildSourceRecord[]).map((source) => this.hydrateSource(source));
  }

  async listSanitizedSources(): Promise<IBuildSourceSummary[]> {
    const sources = await this.db.find(this.buildsSlug, { orderBy: { slug: 'ASC' } });
    return (sources as IBuildSourceRecord[]).map((source) => this.sanitizeSource(source));
  }

  async syncSources(inputs: IBuildSourceInput[]): Promise<IBuildSourceSummary[]> {
    const results: IBuildSourceSummary[] = [];

    for (const input of inputs) {
      // Every field is asserted here, NOT skipped. `sources:sync` is reachable from the hook bus as
      // well as the admin route, so a rejected entry must surface as an error the caller sees — a
      // silent `continue` would let a malformed source vanish with no signal.
      const slug = this.normalizeSlug(input.slug);
      const existing = await this.db.findOne(this.buildsSlug, { slug });
      if (existing) {
        results.push(await this.updateSource(slug, {
          branch: this.normalizeBranch(input.branch),
          gitSecret: input.gitSecret,
          gitUrl: this.normalizeGitUrl(input.gitUrl),
          type: this.normalizeType(input.type),
        }));
        continue;
      }

      results.push(await this.createSource({
        branch: this.normalizeBranch(input.branch),
        gitSecret: input.gitSecret,
        gitUrl: this.normalizeGitUrl(input.gitUrl),
        slug,
        type: this.normalizeType(input.type),
      }));
    }

    return results;
  }

  async updateSource(slug: string, input: IBuildSourceUpdateInput): Promise<IBuildSourceSummary> {
    const existing = await this.db.findOne(this.buildsSlug, { slug });
    if (!existing) {
      throw new Error(`Build source "${slug}" was not found.`);
    }

    const updates: Record<string, unknown> = {};

    if (typeof input.gitUrl === 'string') {
      updates.gitUrl = this.normalizeGitUrl(input.gitUrl);
    }

    if (typeof input.branch === 'string') {
      updates.branch = this.normalizeBranch(input.branch);
    }

    if (typeof input.type === 'string') {
      updates.type = this.normalizeType(input.type);
    }

    if (typeof input.gitSecret === 'string' && input.gitSecret.trim()) {
      updates.gitSecret = this.encryptSecret(input.gitSecret);
    }

    if (typeof input.autoBuild === 'boolean') {
      updates.autoBuild = input.autoBuild;
      // Turning building off turns installing off with it, here as well as in the form: leaving it
      // set would mean a source that installs whatever it happens to build later.
      if (!input.autoBuild) updates.autoUpdate = false;
    }

    if (typeof input.autoUpdate === 'boolean') {
      const building = typeof input.autoBuild === 'boolean' ? input.autoBuild : Boolean(existing.autoBuild);
      updates.autoUpdate = building && input.autoUpdate;
    }

    await this.db.update(this.buildsSlug, { id: existing.id }, updates);
    const refreshed = await this.db.findOne(this.buildsSlug, { slug });
    if (!refreshed) {
      throw new Error(`Build source "${slug}" could not be reloaded after update.`);
    }

    return this.sanitizeSource(refreshed);
  }

  private encryptSecret(secret: string | undefined): string {
    return this.secretService.encrypt(secret || '');
  }

  private hydrateSource(source: IBuildSourceRecord): IBuildSourceRecord {
    const storedSecret = this.readStoredSecret(source);
    return {
      ...this.normalizeSourceRecord(source),
      gitSecret: storedSecret ? this.secretService.decrypt(storedSecret) : '',
    };
  }

  private normalizeBranch(branch: string | undefined): string {
    return GitBranchPolicy.assertAllowed(branch);
  }

  /**
   * The ONLY place a git URL enters this plugin's storage. Validation happens here — before the
   * value is persisted — so a rejected URL can never be re-read from the database and handed to
   * `git` on a later build. See {@link GitUrlPolicy} for what "allowed" means and why.
   */
  private normalizeGitUrl(gitUrl: string | undefined): string {
    return GitUrlPolicy.assertAllowed(gitUrl);
  }

  private normalizeSlug(slug: string | undefined): string {
    return BuildSlugPolicy.assertAllowed(slug);
  }

  private normalizeType(type: BuildSourceType | string | undefined): BuildSourceType {
    return BuildSourceType.resolve(type);
  }

  private readStoredSecret(source: IBuildSourceRecord): string {
    const gitSecret = typeof source.git_secret === 'string'
      ? source.git_secret.trim()
      : (typeof source.gitSecret === 'string' ? source.gitSecret.trim() : '');
    if (gitSecret) {
      return gitSecret;
    }

    const gitToken = typeof source.git_token === 'string'
      ? source.git_token.trim()
      : (typeof source.gitToken === 'string' ? source.gitToken.trim() : '');
    return gitToken;
  }

  private sanitizeSource(source: IBuildSourceRecord): IBuildSourceSummary {
    const normalized = this.normalizeSourceRecord(source);
    const { gitSecret: _gitSecret, gitToken: _gitToken, ...rest } = normalized;
    return {
      ...rest,
      hasGitSecret: Boolean(this.readStoredSecret(source)),
      usesEnvToken: Boolean(process.env.GITHUB_TOKEN?.trim()),
    };
  }

  private normalizeSourceRecord(source: IBuildSourceRecord): IBuildSourceRecord {
    const id = typeof source.id === 'number' || typeof source.id === 'string'
      ? source.id
      : undefined;
    const gitUrl = typeof source.git_url === 'string'
      ? source.git_url
      : (typeof source.gitUrl === 'string' ? source.gitUrl : '');
    const lastBuildAt = typeof source.last_build_at === 'string'
      ? source.last_build_at
      : (typeof source.lastBuildAt === 'string' ? source.lastBuildAt : undefined);
    const lastBuildStatus = typeof source.last_build_status === 'string'
      ? source.last_build_status
      : (typeof source.lastBuildStatus === 'string' ? source.lastBuildStatus : undefined);
    const lastCommitSha = typeof source.last_commit_sha === 'string'
      ? source.last_commit_sha
      : (typeof source.lastCommitSha === 'string' ? source.lastCommitSha : undefined);
    const lastError = typeof source.last_error === 'string'
      ? source.last_error
      : (typeof source.lastError === 'string' ? source.lastError : undefined);
    const fileName = typeof source.file_name === 'string'
      ? source.file_name
      : (typeof source.fileName === 'string' ? source.fileName : undefined);
    const version = typeof source.version === 'string' ? source.version : undefined;

    // READ path: values are passed through as stored, never re-validated. A row written before the
    // transport allow-list existed must still be listable in the admin — the refusal belongs at the
    // point of EXECUTION (BuildService asserts before it invokes git), not at the point of display,
    // where throwing would blank the whole sources list instead of naming the offending row.
    return {
      id,
      // Named explicitly, like every field above: this object is built by hand, so anything not
      // listed is silently dropped on the way to the admin — which is how a new column comes to
      // exist in the database and never appear on the screen that writes it.
      autoBuild: Boolean(source.autoBuild),
      autoUpdate: Boolean(source.autoUpdate),
      branch: (source.branch || '').trim() || GitBranchPolicy.DEFAULT_BRANCH,
      changelog: typeof source.changelog === 'string' ? source.changelog : '',
      fileName,
      gitSecret: this.readStoredSecret(source),
      gitUrl: gitUrl.trim(),
      lastBuildAt,
      lastBuildStatus,
      lastCommitSha,
      lastError,
      slug: (source.slug || '').trim(),
      type: this.normalizeType(source.type),
      version,
    };
  }
}
