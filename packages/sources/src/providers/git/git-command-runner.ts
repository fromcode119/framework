import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import { execFile } from 'child_process';

/**
 * Running `git`, and getting a credential to it without ever putting one on the command line.
 *
 * A token in an argv is visible in the process table to every user on the machine and lands in shell
 * history and crash dumps. So it goes into a throwaway credential CONFIG that git is pointed at for
 * the one invocation, and the file is removed after. That is the whole reason this class exists
 * separately from the service that decides WHAT to fetch.
 *
 * Split out of `GitSyncService` (364 lines).
 */
export class GitCommandRunner {
  /** `git` as a promise. Never through a shell, so nothing in a URL or a branch name can be a command. */
  static readonly execFileAsync = promisify(execFile);

  constructor(
    private readonly logger: any,
  ) {}

  async clone(gitUrl: string, branch: string, targetDir: string, token?: string): Promise<void> {
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

  async pull(targetDir: string, gitUrl: string, branch: string, token?: string): Promise<void> {
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
  async runGit(
    args: string[],
    options: { cwd?: string; timeout?: number },
    token?: string,
    repositoryUrl?: string,
  ): Promise<{ stdout: string; stderr: string }> {
    const credentialFile = this.writeCredentialConfig(token, repositoryUrl);

    try {
      return await GitCommandRunner.execFileAsync('git', args, {
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
  writeCredentialConfig(token: string | undefined, repositoryUrl: string | undefined): string | null {
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

  resolveToken(token?: string): string | null {
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

  isGitRepo(dir: string): boolean {
    return fs.existsSync(path.join(dir, '.git'));
  }
}
