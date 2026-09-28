import { execFileSync } from 'node:child_process';
import type { IChangelogRelease } from './interfaces/changelog-release.interface';

/**
 * The release history, read from git: every `vX.Y.Z` tag, the commit subjects between it and the tag
 * before, and whatever has landed since the newest tag.
 *
 * Git is the record because it is the only one that was always kept. The changelog was written by hand
 * and stopped at a numbering (1.x, 2.0) the releases never used, while 299 tags went out beside it.
 * Squash merges make every PR one commit whose subject is the PR title with `(#N)` appended, so the
 * subjects ARE the release notes.
 */
export class ChangelogHistory {
  private static readonly TAG = /^v(\d+)\.(\d+)\.(\d+)$/;

  constructor(private readonly root: string) {}

  /** Every tagged release, oldest first. */
  releases(): IChangelogRelease[] {
    const tags = this.git(['tag', '--list', 'v*', '--sort=v:refname']).split('\n').filter((tag) => ChangelogHistory.TAG.test(tag));
    return tags.map((tag, index) => ({
      version: tag.slice(1),
      date: this.git(['log', '-1', '--format=%cs', tag]),
      subjects: this.subjects(index === 0 ? tag : `${tags[index - 1]}..${tag}`),
    }));
  }

  /** Commits after the newest tag — what the next release will contain. */
  sinceLatest(latestVersion: string): string[] {
    return latestVersion ? this.subjects(`v${latestVersion}..HEAD`) : this.subjects('HEAD');
  }

  /** `https://github.com/<owner>/<repo>`, from the origin remote, for PR links. '' when there is none. */
  repositoryUrl(): string {
    const remote = this.git(['remote', 'get-url', 'origin']);
    const match = /github\.com[:/]([^/]+)\/([^/.]+?)(?:\.git)?$/.exec(remote);
    return match ? `https://github.com/${match[1]}/${match[2]}` : '';
  }

  private subjects(range: string): string[] {
    return this.git(['log', '--no-merges', '--format=%s', range]).split('\n').map((line) => line.trim()).filter(Boolean);
  }

  private git(args: string[]): string {
    try {
      return execFileSync('git', args, { cwd: this.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
      return '';
    }
  }
}
