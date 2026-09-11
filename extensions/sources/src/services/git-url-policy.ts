/**
 * Transport ALLOW-LIST for every git URL this plugin hands to `git`.
 *
 * A build source URL is not data — it decides what code the platform clones, builds and ships, and
 * it reaches `git` as an argument. Two distinct escapes exist and BOTH are closed here:
 *
 *  1. **Transport abuse.** `git` executes a command by design for some transports
 *     (`ext::sh -c '…'`), and `file://` / a bare absolute path let a caller read anything the API
 *     process can read. Only `https://` is accepted.
 *  2. **Argument injection.** A value beginning with `-` is parsed by git as an OPTION, not a
 *     repository. `--upload-pack=<cmd>` runs `<cmd>` — verified reproducible. `GitSyncService`
 *     additionally passes `--` before positional arguments, so this is defence in depth, not the
 *     only guard.
 *
 * This is an ALLOW-LIST, never a blocklist: anything that is not provably an `https://` URL with a
 * host and no embedded credentials is refused. Embedded credentials (`https://user:pass@host/…`)
 * are refused because git echoes the remote URL in its error text, which this plugin persists to
 * `lastError` and renders in the admin — the token field is the supported way to authenticate.
 */
export class GitUrlPolicy {
  /** The only transport a build source may use. */
  static readonly ALLOWED_SCHEME = 'https:';

  /** Human-readable statement of the rule, reused by every rejection message. */
  static readonly REQUIREMENT = 'Only https:// repository URLs are accepted.';

  /**
   * Returns the normalised URL, or throws with a message naming the rule it broke.
   * Every write path (`createSource`, `updateSource`, `syncSources`) funnels through this.
   */
  static assertAllowed(gitUrl: unknown): string {
    const normalized = String(gitUrl ?? '').trim();

    if (!normalized) {
      throw new Error('Git URL is required.');
    }
    if (normalized.startsWith('-')) {
      throw new Error(`Git URL rejected: a value starting with "-" is parsed by git as an option, not a repository. ${GitUrlPolicy.REQUIREMENT}`);
    }
    if (GitUrlPolicy.hasUnsafeCharacter(normalized)) {
      throw new Error('Git URL rejected: it contains whitespace or a control character.');
    }

    const parsed = GitUrlPolicy.parse(normalized);
    if (!parsed) {
      throw new Error(`Git URL rejected: "${GitUrlPolicy.describe(normalized)}" is not a valid absolute URL. ${GitUrlPolicy.REQUIREMENT}`);
    }
    if (parsed.protocol !== GitUrlPolicy.ALLOWED_SCHEME) {
      throw new Error(`Git URL rejected: the "${parsed.protocol.replace(':', '')}" transport is not allowed. ${GitUrlPolicy.REQUIREMENT}`);
    }
    if (!parsed.hostname) {
      throw new Error(`Git URL rejected: no host. ${GitUrlPolicy.REQUIREMENT}`);
    }
    if (parsed.username || parsed.password) {
      throw new Error('Git URL rejected: credentials embedded in the URL are not accepted — use the repository token field instead.');
    }

    return normalized;
  }

  /** Non-throwing form, for callers that only need the verdict. */
  static isAllowed(gitUrl: unknown): boolean {
    try {
      GitUrlPolicy.assertAllowed(gitUrl);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * True when the value carries any whitespace or C0/DEL control character. A URL never legitimately
   * contains one, and a newline or NUL can split or truncate a value in downstream tooling. Written
   * as a codepoint scan rather than a regex literal so no control byte ever appears in this source.
   */
  private static hasUnsafeCharacter(value: string): boolean {
    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index);
      if (code <= 0x20 || code === 0x7f) {
        return true;
      }
    }
    return false;
  }

  private static parse(value: string): URL | null {
    try {
      return new URL(value);
    } catch {
      return null;
    }
  }

  /** Truncate the echoed value so a hostile URL cannot flood a stored error message. */
  private static describe(value: string): string {
    return value.length > 80 ? `${value.slice(0, 80)}…` : value;
  }
}
