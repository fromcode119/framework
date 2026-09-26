import chalk from 'chalk';
import type { RemoteShell } from '@cli/services/deploy/remote-shell';

/**
 * Brings the deploy directory's compose files to what the release being deployed shipped.
 *
 * A deploy used to change only the image tag: a compose change in a release — a memory limit, a new
 * volume, a new service — never reached the box unless someone edited the file there by hand, and a
 * box that was edited by hand drifted from the repository without anyone seeing how. The deploy
 * directory is a checkout of the framework repository, so the release's own files are one fetch away.
 *
 * Only TRACKED files under the deploy directory are replaced — `.env` and the `.bak` copies are not in
 * the repository and are never touched. What changed is printed, so the operator sees it. A target that
 * is not a git checkout keeps its files exactly as before, and says so.
 */
export class ComposeFilesSync {
  constructor(private readonly shell: Pick<RemoteShell, 'run'>) {}

  /** The files that changed, or null when the target is not a checkout (nothing is synced there). */
  async sync(version: string): Promise<string[] | null> {
    const tag = ComposeFilesSync.tag(version);
    const inside = await this.shell.run('git rev-parse --is-inside-work-tree');
    if (inside.code !== 0 || inside.stdout.trim() !== 'true') {
      console.warn(chalk.yellow('The deploy directory is not a git checkout; its compose files are left as they are.'));
      return null;
    }
    const fetched = await this.shell.run(`git fetch --quiet origin tag ${tag}`);
    if (fetched.code !== 0) throw new Error(`Could not fetch ${tag} for its compose files: ${fetched.stderr.trim()}`);
    const changed = (await this.shell.run(`git diff --name-only ${tag} -- .`)).stdout.split('\n').map((line) => line.trim()).filter(Boolean);
    const checkedOut = await this.shell.run(`git checkout ${tag} -- .`);
    if (checkedOut.code !== 0) throw new Error(`Could not check out ${tag}'s compose files: ${checkedOut.stderr.trim()}`);
    console.log(changed.length ? chalk.blue(`Deploy files from ${tag}: ${changed.join(', ')}`) : chalk.gray(`Deploy files already match ${tag}.`));
    return changed;
  }

  /** `v0.2.205` / `0.2.205` → `v0.2.205`; anything else is refused before it reaches a shell. */
  static tag(version: string): string {
    const match = /^v?(\d+\.\d+\.\d+)$/.exec(String(version).trim());
    if (!match) throw new Error(`Refusing to sync deploy files for "${version}": not a release version.`);
    return `v${match[1]}`;
  }
}
