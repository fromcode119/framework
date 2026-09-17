import { BuildErrorRedactionService } from '@sources/packaging/build-error-redaction-service';

/**
 * Turning git's stderr into something an operator can act on.
 *
 * git reports everything as a non-zero exit and a line of prose, so the difference between "this
 * repository needs a token", "git is not installed" and "that branch does not exist" is only in the
 * text. Reading it here means the sources screen can say which, instead of showing the operator a
 * raw stderr dump and leaving them to guess.
 *
 * Static and pure, so each reading is testable on its own.
 */
export class GitErrorReader {
  static readonly NEEDS_TOKEN_MESSAGE =
    'This repository is private, or does not exist. Add a personal access token with read access to it.';

  static explain(error: unknown): string {
    if (GitErrorReader.isMissingGit(error)) return GitErrorReader.MISSING_GIT_MESSAGE;

    /**
     * `could not read Username for 'https://github.com': terminal prompts disabled` is git asking
     * for credentials on a machine with no terminal. It is the single most likely failure an
     * operator will hit — a private repository, no token yet — and as raw git output it reads like
     * a fault in the server rather than a missing field on the form.
     */
    if (GitErrorReader.needsCredentials(error)) return GitErrorReader.NEEDS_TOKEN_MESSAGE;

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

  static needsCredentials(error: unknown): boolean {
    const text = String((error as any)?.stderr || (error as any)?.message || error);
    return text.includes('could not read Username')
      || text.includes('Authentication failed')
      || text.includes('Repository not found');
  }

  static isMissingGit(error: unknown): boolean {
    return String((error as any)?.code || '') === 'ENOENT' || String(error).includes('spawn git ENOENT');
  }

  /** `<sha>\trefs/heads/<name>` per line. Names are returned as the remote spells them. */
  static parseBranchRefs(stdout: string): string[] {
    return stdout
      .split('\n')
      .map((line) => line.split('\t')[1] || '')
      .filter((ref) => ref.startsWith('refs/heads/'))
      .map((ref) => ref.slice('refs/heads/'.length).trim())
      .filter((name) => name !== '');
  }
}
