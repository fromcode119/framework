import { execFile } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '@fromcode119/sdk/server';
import { GitBranchPolicy } from '@plugin/src/services/git-branch-policy';
import { GitUrlPolicy } from '@plugin/src/services/git-url-policy';
import { BuildErrorRedactionService } from '@plugin/src/services/build-error-redaction-service';
import { ExtensionManifestReader } from '@plugin/src/services/extension-manifest-reader';

/**
 * Handles git operations for marketplace source repositories.
 *
 * Three separate protections, all required:
 *  1. `execFile` (never `exec`) — arguments are an ARRAY, so no shell parses them and no shell
 *     metacharacter in any value can start a second command.
 *  2. `GitUrlPolicy` / `GitBranchPolicy` are asserted immediately before every invocation. A stored
 *     row is untrusted input: it may predate the allow-list, or have been written through a path
 *     that skipped it.
 *  3. `--` terminates options before every positional argument, so a repository or ref value can
 *     never be re-read by git as an option. Without it, `--upload-pack=<cmd>` runs `<cmd>`.
 *
 * The credential is passed through a private config FILE (`GIT_CONFIG_GLOBAL`), never argv —
 * argv is world-readable via `ps` / `/proc/<pid>/cmdline` on the host.
 */
export class GitSyncService {
  private static readonly execFileAsync = promisify(execFile);

  private readonly logger = new Logger({ namespace: 'GitSyncService' });

  constructor(private sourceDir: string) {
    fs.mkdirSync(this.sourceDir, { recursive: true });
  }

  /**
   * Clone or update a repository. Returns the target directory path.
   */
  async sync(gitUrl: string, branch: string, type: string, slug: string, token?: string): Promise<string> {
    const safeUrl = GitUrlPolicy.assertAllowed(gitUrl);
    const safeBranch = GitBranchPolicy.assertAllowed(branch);
    const targetDir = path.join(this.sourceDir, type, slug);
    this.logger.debug(`[GitSyncService.sync] slug=${slug} tokenPresent=${!!this.resolveToken(token)}`);

    if (this.isGitRepo(targetDir)) {
      await this.pull(targetDir, safeUrl, safeBranch, token);
    } else {
      await this.clone(safeUrl, safeBranch, targetDir, token);
    }

    return targetDir;
  }

  /**
   * Get the HEAD commit SHA for change detection.
   */
  async getLatestCommitSha(targetDir: string): Promise<string | null> {
    if (!this.isGitRepo(targetDir)) return null;

    try {
      const { stdout } = await GitSyncService.execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: targetDir });
      return stdout.trim();
    } catch {
      return null;
    }
  }

  /**
   * Get the remote HEAD commit SHA without cloning (for update detection).
   */
  async getRemoteHeadSha(gitUrl: string, branch: string, token?: string): Promise<string | null> {
    let safeUrl: string;
    let safeBranch: string;
    try {
      safeUrl = GitUrlPolicy.assertAllowed(gitUrl);
      safeBranch = GitBranchPolicy.assertAllowed(branch);
    } catch (err) {
      // A stored source that the allow-list refuses is never contacted. Reported as "no remote SHA",
      // which surfaces as "update available: unknown" rather than silently pretending it is current.
      this.logger.warn(`Refusing to contact remote: ${String(err)}`);
      return null;
    }

    try {
      const { stdout } = await this.runGit(
        ['ls-remote', '--', safeUrl, `refs/heads/${safeBranch}`],
        { timeout: 30000 },
        token,
        safeUrl,
      );
      const sha = stdout.split('\t')[0]?.trim();
      return sha || null;
    } catch (err) {
      this.logger.error(`Remote SHA check failed for ${safeUrl}: ${String(err)}`);
      return null;
    }
  }

  /**
   * The branches a remote actually has, without cloning it.
   *
   * The branch was a free-text box defaulting to "main", so a repository whose default is `master`
   * or `develop` produced a source that failed at its first build with a git error — a typo and a
   * wrong-but-real branch name were indistinguishable until then. Asking the remote is the only
   * honest way to populate it: nothing here guesses a name.
   *
   * Same `ls-remote` path, and therefore the same allow-list and the same argument-array rules as
   * every other remote call in this class.
   */
  async listBranches(gitUrl: string, token?: string): Promise<string[]> {
    let safeUrl: string;
    try {
      safeUrl = GitUrlPolicy.assertAllowed(gitUrl);
    } catch (err) {
      this.logger.warn(`Refusing to contact remote: ${String(err)}`);
      return [];
    }

    try {
      const { stdout } = await this.runGit(
        ['ls-remote', '--heads', '--', safeUrl],
        { timeout: 30000 },
        token,
        safeUrl,
      );
      return GitSyncService.parseBranchRefs(stdout);
    } catch (err) {
      this.logger.error(`Branch listing failed for ${safeUrl}: ${String(err)}`);
      // A repository with no branches is the ONLY thing an empty list may mean. Everything else —
      // git absent, a certificate the host cannot verify, a private repo without a token — is a
      // different problem with a different fix, and all of them used to arrive here as "no
      // branches", which reads as a fact about the repository. Git's own words, redacted, say more
      // than any sentence this class could invent.
      throw new Error(GitSyncService.explain(err));
    }
  }

  /**
   * The commit subjects between two revisions, newest first.
   *
   * This is the changelog. Not a generated summary of a diff — the subjects people wrote when they
   * made the changes, which is the only description of a release that anybody actually authored.
   * An empty list is honest: a build with no previous revision has nothing to compare against, and
   * the screen says so rather than inventing "initial release".
   */
  async changesSince(targetDir: string, previousSha: string): Promise<string[]> {
    if (!previousSha || !this.isGitRepo(targetDir)) return [];

    try {
      /**
       * Clones here are `--depth 1`, so the previous revision is not in the repository and the range
       * cannot resolve — the changelog would be empty every single time. Deepening is done HERE
       * rather than by cloning deeper, so the cost lands only on a build that actually wants one.
       */
      await GitSyncService.execFileAsync(
        'git',
        ['fetch', `--deepen=${GitSyncService.CHANGELOG_DEPTH}`, '--quiet'],
        { cwd: targetDir, timeout: 60000 },
      ).catch(() => undefined);

      const { stdout } = await GitSyncService.execFileAsync(
        'git',
        // `--no-merges`: a merge commit's subject is "Merge pull request #12", which describes the
        // act of merging rather than what changed.
        ['log', '--no-merges', '--pretty=format:%s', `${previousSha}..HEAD`],
        { cwd: targetDir, timeout: 30000 },
      );
      return String(stdout || '')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '')
        .slice(0, GitSyncService.MAX_CHANGELOG_LINES);
    } catch (err) {
      // A shallow clone cannot reach the previous revision. Reported as "no changelog", never as a
      // build failure — the build itself succeeded.
      this.logger.debug(`No changelog for ${targetDir}: ${String(err)}`);
      return [];
    }
  }

  /** Enough to see what a release was; a year of commits in a dialog is not a changelog. */
  private static readonly MAX_CHANGELOG_LINES = 50;

  /** How far back to deepen a shallow clone so a range against the previous build can resolve. */
  private static readonly CHANGELOG_DEPTH = 200;

  /** What git says when a repository needs credentials it was not given. */
  static readonly NEEDS_TOKEN_MESSAGE =
    'This repository is private, or does not exist. Add a personal access token with read access to it.';

  /** Git's reason, stripped of anything secret and cut to the line that carries the meaning. */
  private static explain(error: unknown): string {
    if (GitSyncService.isMissingGit(error)) return GitSyncService.MISSING_GIT_MESSAGE;

    /**
     * `could not read Username for 'https://github.com': terminal prompts disabled` is git asking
     * for credentials on a machine with no terminal. It is the single most likely failure an
     * operator will hit — a private repository, no token yet — and as raw git output it reads like
     * a fault in the server rather than a missing field on the form.
     */
    if (GitSyncService.needsCredentials(error)) return GitSyncService.NEEDS_TOKEN_MESSAGE;

    const redacted = BuildErrorRedactionService.redact((error as any)?.stderr || (error as any)?.message || error);
    const meaningful = redacted
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('Command failed:'))
      .pop();

    return meaningful || 'The repository could not be read.';
  }

  /** The message the admin shows when the host has no git; stated once, used by both call paths. */
  static readonly MISSING_GIT_MESSAGE = 'git is not installed on this server, so repositories cannot be read.';

  private static needsCredentials(error: unknown): boolean {
    const text = String((error as any)?.stderr || (error as any)?.message || error);
    return text.includes('could not read Username')
      || text.includes('Authentication failed')
      || text.includes('Repository not found');
  }

  private static isMissingGit(error: unknown): boolean {
    return String((error as any)?.code || '') === 'ENOENT' || String(error).includes('spawn git ENOENT');
  }

  /** `<sha>\trefs/heads/<name>` per line. Names are returned as the remote spells them. */
  private static parseBranchRefs(stdout: string): string[] {
    return stdout
      .split('\n')
      .map((line) => line.split('\t')[1] || '')
      .filter((ref) => ref.startsWith('refs/heads/'))
      .map((ref) => ref.slice('refs/heads/'.length).trim())
      .filter((name) => name !== '');
  }

  /**
   * What the repository says it is, without adding it as a source.
   *
   * A shallow single-branch clone into a temporary directory, read, then removed. It costs one clone
   * of one branch at depth 1 — the same thing the first build would do anyway — and it is the only
   * way to learn an extension's declared slug, because that slug lives in a file inside the repo.
   * Reading it is what stops the operator from typing a second, conflicting one.
   */
  async inspect(gitUrl: string, branch: string, token?: string): Promise<{ slug: string; type: string; name: string; version: string } | null> {
    const safeUrl = GitUrlPolicy.assertAllowed(gitUrl);
    const safeBranch = GitBranchPolicy.assertAllowed(branch);
    const targetDir = path.join(this.sourceDir, '.inspect', `${Date.now()}-${Math.random().toString(36).slice(2)}`);

    try {
      await this.clone(safeUrl, safeBranch, targetDir, token);
      return ExtensionManifestReader.read(targetDir);
    } catch (err) {
      this.logger.warn(`Inspect failed for ${safeUrl}#${safeBranch}: ${String(err)}`);
      return null;
    } finally {
      // Always removed: this directory is a question, not a source, and a failed clone leaves debris.
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
  }

  private async clone(gitUrl: string, branch: string, targetDir: string, token?: string): Promise<void> {
    fs.mkdirSync(path.dirname(targetDir), { recursive: true });

    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }

    // `--` before the positional repository/directory pair: without it a repository value beginning
    // with `-` is parsed as an option, and `--upload-pack=<cmd>` executes `<cmd>`.
    await this.runGit(
      ['clone', '--depth', '1', '--branch', branch, '--quiet', '--', gitUrl, targetDir],
      { timeout: 120000 },
      token,
      gitUrl,
    );
  }

  private async pull(targetDir: string, gitUrl: string, branch: string, token?: string): Promise<void> {
    try {
      await this.runGit(['remote', 'set-url', 'origin', gitUrl], { cwd: targetDir }, undefined, gitUrl);
      await this.runGit(
        ['fetch', '--depth', '1', '--', 'origin', branch],
        { cwd: targetDir, timeout: 60000 },
        token,
        gitUrl,
      );
      await this.runGit(['reset', '--hard', `origin/${branch}`, '--'], { cwd: targetDir });
    } catch (err) {
      this.logger.warn(`Pull failed, retrying with fresh clone: ${err}`);
      await this.clone(gitUrl, branch, targetDir, token);
    }
  }

  /**
   * Single invocation point for `git`. Owns the hardened environment and the credential lifetime:
   * the token is written to a 0600 config file that exists only for the duration of the call, so it
   * never appears in argv and never lands in a shared git config.
   */
  private async runGit(
    args: string[],
    options: { cwd?: string; timeout?: number },
    token?: string,
    repositoryUrl?: string,
  ): Promise<{ stdout: string; stderr: string }> {
    const credentialFile = this.writeCredentialConfig(token, repositoryUrl);

    try {
      return await GitSyncService.execFileAsync('git', args, {
        ...options,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
          // Never inherit a system/global config that could re-enable a disallowed transport or add
          // an insteadOf rewrite. When a credential file exists it is the ONLY global config.
          GIT_CONFIG_NOSYSTEM: '1',
          GIT_CONFIG_GLOBAL: credentialFile || os.devNull,
        },
      }) as { stdout: string; stderr: string };
    } finally {
      if (credentialFile) {
        // Remove the whole private directory, not just the file — the token must not outlive the call.
        fs.rmSync(path.dirname(credentialFile), { force: true, recursive: true });
      }
    }
  }

  /**
   * Write the Authorization header into a private git config file and return its path, or null when
   * there is no token or the repository is not one we are willing to send it to.
   */
  private writeCredentialConfig(token: string | undefined, repositoryUrl: string | undefined): string | null {
    const activeToken = this.resolveToken(token);
    if (!activeToken || !repositoryUrl?.startsWith('https://github.com/')) {
      return null;
    }

    const basicAuthValue = Buffer.from(`x-access-token:${activeToken}`).toString('base64');
    const filePath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'fc-build-git-')),
      'config',
    );
    fs.writeFileSync(filePath, `[http]\n\textraHeader = Authorization: Basic ${basicAuthValue}\n`, { mode: 0o600 });
    return filePath;
  }

  private resolveToken(token?: string): string | null {
    const directToken = token?.trim();
    if (directToken) {
      return directToken;
    }

    const envToken = process.env.GITHUB_TOKEN?.trim();
    if (envToken) {
      return envToken;
    }

    return null;
  }

  private isGitRepo(dir: string): boolean {
    return fs.existsSync(path.join(dir, '.git'));
  }
}
