/**
 * Strips credentials out of a git/npm failure message before it is persisted to `lastError` and
 * rendered in the admin.
 *
 * Both tools quote back what they were given: git echoes the remote URL, npm echoes registry URLs
 * and, on a 401, the `Authorization` header value. Any of those can carry a token. The message is
 * operator-facing diagnostic text, so it is kept — only the secret-bearing spans are replaced, and
 * the replacement is visible (`[redacted]`), never a silent deletion.
 */
export class BuildErrorRedactionService {
  static readonly MARKER = '[redacted]';

  static redact(message: unknown): string {
    let text = String(message ?? '');

    // userinfo in any URL: scheme://user:secret@host  ->  scheme://[redacted]@host
    text = text.replace(/([a-z][a-z0-9+.-]*:\/\/)[^/\s@]+@/gi, `$1${BuildErrorRedactionService.MARKER}@`);
    // Authorization header values, however they are quoted.
    text = text.replace(/(authorization\s*[:=]\s*)(?:basic|bearer|token)?\s*\S+/gi, `$1${BuildErrorRedactionService.MARKER}`);
    // GitHub's own token formats, which appear in npm/git output verbatim.
    text = text.replace(/\bgh[pousr]_[A-Za-z0-9]{16,}\b/g, BuildErrorRedactionService.MARKER);
    text = text.replace(/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, BuildErrorRedactionService.MARKER);
    // The synthetic username git is given alongside a PAT.
    text = text.replace(/x-access-token:\S+/gi, `x-access-token:${BuildErrorRedactionService.MARKER}`);
    // npm's `_authToken=` / `//registry/:_authToken=` lines from a leaked .npmrc.
    text = text.replace(/(_auth(?:Token)?\s*=\s*)\S+/gi, `$1${BuildErrorRedactionService.MARKER}`);

    return text;
  }
}
