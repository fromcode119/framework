import type { IBuildSourceRecord } from '@sources/sources/interfaces/build-source-record.interface';
import type { IBuildSourceSummary } from '@sources/sources/interfaces/build-source-summary.interface';
import { ExtensionScope } from '@fromcode119/core';
import { GitBranchPolicy } from '@sources/providers/git/git-branch-policy';
import { GitUrlPolicy } from '@sources/providers/git/git-url-policy';
import { SourceProviders } from '@sources/providers/source-providers';

/**
 * Between the row and the record: normalising what a caller sent, and deciding what a caller is
 * allowed to see back.
 *
 * `sanitize` is the half that matters. A source row holds an access TOKEN, and the only safe default
 * is that nothing leaves this class carrying one — so the sanitised shape reports whether a secret
 * exists and never what it is. A token reaches the outside exactly once, in `readStoredSecret`, and
 * only for the code that is about to hand it to git.
 *
 * Split out of `BuildSourceService` (338 lines), which owns the reads and writes.
 */
export class BuildSourceMapper {
  constructor(
    private readonly secretService: any,
  ) {}

  encryptSecret(secret: string | undefined): string {
    return this.secretService.encrypt(secret || '');
  }

  hydrateSource(source: IBuildSourceRecord): IBuildSourceRecord {
    const storedSecret = this.readStoredSecret(source);
    return {
      ...this.normalizeSourceRecord(source),
      gitSecret: storedSecret ? this.secretService.decrypt(storedSecret) : '',
    };
  }

  normalizeBranch(branch: string | undefined): string {
    return GitBranchPolicy.assertAllowed(branch);
  }

  /**
   * The ONLY place a git URL enters this plugin's storage. Validation happens here — before the
   * value is persisted — so a rejected URL can never be re-read from the database and handed to
   * `git` on a later build. See {@link GitUrlPolicy} for what "allowed" means and why.
   */
  normalizeGitUrl(gitUrl: string | undefined): string {
    return GitUrlPolicy.assertAllowed(gitUrl);
  }

  normalizeType(type: ExtensionScope | string | undefined): ExtensionScope {
    return ExtensionScope.resolve(type);
  }

  readStoredSecret(source: IBuildSourceRecord): string {
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

  sanitizeSource(source: IBuildSourceRecord): IBuildSourceSummary {
    const normalized = this.normalizeSourceRecord(source);
    const { gitSecret: _gitSecret, gitToken: _gitToken, ...rest } = normalized;
    return {
      ...rest,
      hasGitSecret: Boolean(this.readStoredSecret(source)),
      usesEnvToken: Boolean(process.env.GITHUB_TOKEN?.trim()),
    };
  }

  /**
   * A boolean column, whichever spelling the driver handed back.
   *
   * Postgres returns a real boolean; SQLite returns 0/1; an API payload may send the string "true".
   * `Boolean("false")` is `true`, so the string case has to be named rather than coerced.
   */
  static readFlag(...candidates: unknown[]): boolean {
    for (const candidate of candidates) {
      if (candidate === undefined || candidate === null) continue;
      if (typeof candidate === 'string') return candidate.trim().toLowerCase() === 'true';
      return Boolean(candidate);
    }
    return false;
  }

  normalizeSourceRecord(source: IBuildSourceRecord): IBuildSourceRecord {
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
      // Snake FIRST, like every field above. These are the real COLUMN names, and this service now
      // reads through the framework's raw database manager, which does not denormalize — that was a
      // plugin-context convenience, and Sources is not a plugin. Reading only the camel spelling made
      // "Build automatically" come back false for a source whose `auto_build` was true: the toggle
      // saved, the timer honoured the column, and the screen said it was off.
      autoBuild: BuildSourceMapper.readFlag(source.auto_build, source.autoBuild),
      autoUpdate: BuildSourceMapper.readFlag(source.auto_update, source.autoUpdate),
      // A row written before the column existed reads NULL. The migration states TRUE for every
      // such row, so a null here means the migration has not run yet — and the build path reads the
      // same column, so both agree either way.
      installAfterBuild: BuildSourceMapper.readFlag(source.install_after_build, source.installAfterBuild),
      branch: (source.branch || '').trim() || GitBranchPolicy.DEFAULT_BRANCH,
      provider: SourceProviders.normalize(source.provider),
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
