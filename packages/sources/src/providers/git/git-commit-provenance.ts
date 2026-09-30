import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GitCommandRunner } from '@sources/providers/git/git-command-runner';
import { GitHubCommitSigningKeys } from '@sources/providers/git/github-commit-signing-keys';

/**
 * Whether a commit about to be BUILT reached its branch through GitHub itself.
 *
 * Sources builds a repository's branch on the box every site runs on, and what it builds is installed.
 * The branch is protected on GitHub — changes arrive only as reviewed pull requests — but a clone
 * cannot tell a merge from anything else that ends up at the same ref: a push with a leaked token, a
 * rewritten tag, a tampered mirror. GitHub signs every commit it makes itself (a merged or squashed
 * pull request) with its own key and never one somebody pushed, so a commit carrying that signature is
 * a commit GitHub merged. That is what is checked, with GitHub's keys pinned in
 * `GitHubCommitSigningKeys`, before anything is built.
 *
 * Verified with `gpgv`, which reads only the keyring it is handed — nothing on the box can add a key
 * the check would then trust.
 */
export class GitCommitProvenance {
  static readonly GITHUB_HOST = 'github.com';

  static isGitHub(location: string): boolean {
    try {
      return new URL(String(location ?? '')).hostname.toLowerCase() === GitCommitProvenance.GITHUB_HOST;
    } catch {
      return false;
    }
  }

  /** Throws, naming the reason and the way out, unless `revision` is a commit GitHub signed. */
  static async assertMergedByGitHub(directory: string, revision: string, location: string): Promise<void> {
    const way = 'Merge it through a pull request, or allow it in Settings → General → "Build commits not merged through GitHub".';
    if (!GitCommitProvenance.isGitHub(location)) {
      throw new Error(`Not built: this source is not on GitHub, so where its commits came from cannot be verified. ${way}`);
    }
    const sha = String(revision ?? '').trim();
    if (!/^[0-9a-f]{7,64}$/i.test(sha)) {
      throw new Error(`Not built: the revision to build is unknown, so it cannot be verified. ${way}`);
    }
    const short = sha.slice(0, 12);
    const { stdout } = await GitCommandRunner.execFileAsync('git', ['cat-file', 'commit', sha], { cwd: directory, maxBuffer: 16 * 1024 * 1024 });
    const { payload, signature } = GitCommitProvenance.split(String(stdout));
    if (!signature) {
      throw new Error(`Not built: commit ${short} is not signed, so it was not merged through GitHub. ${way}`);
    }

    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-provenance-'));
    try {
      const keyring = path.join(work, 'github.gpg');
      const signatureFile = path.join(work, 'commit.sig');
      const payloadFile = path.join(work, 'commit.txt');
      fs.writeFileSync(keyring, GitCommitProvenance.dearmor(GitHubCommitSigningKeys.ARMORED));
      fs.writeFileSync(signatureFile, signature);
      fs.writeFileSync(payloadFile, payload);
      try {
        await GitCommandRunner.execFileAsync('gpgv', ['--keyring', keyring, signatureFile, payloadFile], {
          env: { PATH: process.env.PATH ?? '/usr/bin:/bin', GNUPGHOME: work },
        });
      } catch (error: any) {
        if (error?.code === 'ENOENT') {
          throw new Error(`Not built: this server has no gpgv, so commit ${short} cannot be verified. ${way}`);
        }
        throw new Error(`Not built: commit ${short} is not signed by GitHub, so it was not merged through GitHub. ${way}`);
      }
    } finally {
      fs.rmSync(work, { recursive: true, force: true });
    }
  }

  /** A raw commit object split into the signed text and its detached signature (`gpgsig` header). */
  static split(raw: string): { payload: string; signature: string } {
    const boundary = raw.indexOf('\n\n');
    const head = boundary >= 0 ? raw.slice(0, boundary) : raw;
    const message = boundary >= 0 ? raw.slice(boundary) : '';
    const kept: string[] = [];
    const signature: string[] = [];
    const lines = head.split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!line.startsWith('gpgsig ')) {
        kept.push(line);
        continue;
      }
      signature.push(line.slice('gpgsig '.length));
      while (index + 1 < lines.length && lines[index + 1].startsWith(' ')) {
        index += 1;
        signature.push(lines[index].slice(1));
      }
    }
    return { payload: kept.join('\n') + message, signature: signature.length ? `${signature.join('\n')}\n` : '' };
  }

  /** The binary keyring `gpgv` reads, from an ASCII-armored public key block. */
  static dearmor(armored: string): Buffer {
    const lines = armored.replace(/\r/g, '').split('\n');
    const start = lines.findIndex((line) => line.trim() === '') + 1;
    const body = lines.slice(start).filter((line) => line && !line.startsWith('=') && !line.startsWith('-----'));
    return Buffer.from(body.join(''), 'base64');
  }
}
