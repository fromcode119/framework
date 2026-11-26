import fs from 'fs';
import path from 'path';
import { StackCommand } from '@cli/services/stack/stack-command';
import { StackLayout } from '@cli/services/stack/stack-layout';

/**
 * The files of one release that a stack needs when it runs the release as published.
 *
 * The images already hold the built platform, so there is nothing to build or mount from a checkout:
 * only the deploy topology and the root manifest that goes with it, read out of the release's tag
 * without checking anything out. The result holds nothing a build writes into, so any number of
 * stacks share it.
 */
export class StackReleaseSource {
  /** Under a dot, so it is never listed as a stack. */
  private static readonly DIRECTORY = '.releases';

  private static readonly FILES = [StackLayout.DEPLOY_DIR, 'package.json'];

  constructor(
    private readonly repository: string,
    private readonly stacksRoot: string,
    private readonly run: typeof StackCommand.output = StackCommand.output,
  ) {}

  /** The directory holding the release's files, written the first time it is asked for. */
  async directoryFor(tag: string): Promise<string> {
    const directory = path.join(this.stacksRoot, StackReleaseSource.DIRECTORY, tag);
    if (fs.existsSync(directory)) return directory;

    await this.ensureTag(tag);
    fs.mkdirSync(path.dirname(directory), { recursive: true });
    const partial = fs.mkdtempSync(`${directory}.partial-`);
    try {
      const archive = path.join(partial, 'release.tar');
      await this.must('git', ['-C', this.repository, 'archive', '--format=tar', `--output=${archive}`, `refs/tags/${tag}`, '--', ...StackReleaseSource.FILES]);
      await this.must('tar', ['-C', partial, '-xf', archive]);
      fs.rmSync(archive);
      // Another stack may have written it while this one did; theirs is the same release.
      if (!fs.existsSync(directory)) fs.renameSync(partial, directory);
    } finally {
      fs.rmSync(partial, { recursive: true, force: true });
    }
    return directory;
  }

  private async ensureTag(tag: string): Promise<void> {
    const commit = ['-C', this.repository, 'cat-file', '-e', `refs/tags/${tag}^{commit}`];
    if ((await this.run('git', commit)) !== null) return;

    await this.must('git', ['-C', this.repository, 'fetch', '--quiet', '--no-tags', 'origin', `refs/tags/${tag}:refs/tags/${tag}`]);
  }

  private async must(file: string, args: string[]): Promise<void> {
    if ((await this.run(file, args)) === null) throw new Error(`Command failed: ${file} ${args.join(' ')}`);
  }
}
