/**
 * Validates the branch name that reaches `git` as an argument.
 *
 * `--branch <b>` consumes its value positionally, so a leading `-` cannot become an option there —
 * but the same value is also interpolated into `refs/heads/<b>` and `origin/<b>` and used to build
 * a checkout, so it must still be a real ref name. This is an allow-list of the ref characters git
 * itself permits, plus the `git check-ref-format` rules that matter here (no `..`, no leading/
 * trailing `/` or `.`, no `@{`).
 */
export class GitBranchPolicy {
  /** Used when the caller supplies nothing. Mirrors git's own initial-branch convention. */
  static readonly DEFAULT_BRANCH = 'main';

  static readonly REQUIREMENT = 'A branch may contain letters, digits, "." "_" "-" "/" only.';

  /** Returns the normalised branch, falling back to {@link DEFAULT_BRANCH} when unset. */
  static assertAllowed(branch: unknown): string {
    const normalized = String(branch ?? '').trim() || GitBranchPolicy.DEFAULT_BRANCH;

    if (!/^[A-Za-z0-9._\/-]+$/.test(normalized)) {
      throw new Error(`Branch rejected: "${normalized}" is not a valid git ref name. ${GitBranchPolicy.REQUIREMENT}`);
    }
    if (normalized.startsWith('-') || normalized.startsWith('/') || normalized.startsWith('.')) {
      throw new Error(`Branch rejected: "${normalized}" may not start with "-", "/" or ".".`);
    }
    if (normalized.endsWith('/') || normalized.endsWith('.') || normalized.endsWith('.lock')) {
      throw new Error(`Branch rejected: "${normalized}" may not end with "/", "." or ".lock".`);
    }
    if (normalized.includes('..') || normalized.includes('//') || normalized.includes('@{')) {
      throw new Error(`Branch rejected: "${normalized}" contains a sequence git forbids in a ref name.`);
    }

    return normalized;
  }
}
