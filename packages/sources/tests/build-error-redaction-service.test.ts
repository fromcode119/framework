import { describe, expect, it } from 'vitest';
import { BuildErrorRedactionService } from '@sources/packaging/build-error-redaction-service';

/**
 * A build failure message is persisted to `lastError` and rendered verbatim in the admin. git and
 * npm both echo back what they were given, which routinely includes a credential.
 */
describe('BuildErrorRedactionService', () => {
  it('removes userinfo credentials from an echoed remote URL', () => {
    const redacted = BuildErrorRedactionService.redact(
      "fatal: could not read from 'https://x-access-token:ghp_AAAAAAAAAAAAAAAAAAAA@github.com/o/r.git'",
    );
    expect(redacted).not.toContain('ghp_AAAAAAAAAAAAAAAAAAAA');
    expect(redacted).toContain('[redacted]');
    // The diagnostic value survives — the host and the failure are still readable.
    expect(redacted).toContain('github.com/o/r.git');
  });

  it('removes an Authorization header value', () => {
    const redacted = BuildErrorRedactionService.redact('npm ERR! headers: Authorization: Basic eHNlY3JldA==');
    expect(redacted).not.toContain('eHNlY3JldA==');
    expect(redacted).toContain('[redacted]');
  });

  it('removes a bare GitHub token appearing anywhere in the text', () => {
    expect(BuildErrorRedactionService.redact('token ghp_0123456789abcdefghij rejected'))
      .not.toContain('ghp_0123456789abcdefghij');
    expect(BuildErrorRedactionService.redact('github_pat_11ABCDEFG0aaaaaaaaaaaaaa is invalid'))
      .not.toContain('github_pat_11ABCDEFG0aaaaaaaaaaaaaa');
  });

  it('removes an npm _authToken echoed from a leaked .npmrc', () => {
    const redacted = BuildErrorRedactionService.redact('//registry.npmjs.org/:_authToken=npm_SeCrEtValue123');
    expect(redacted).not.toContain('npm_SeCrEtValue123');
  });

  it('leaves a message with no credential untouched', () => {
    const message = 'fatal: repository not found';
    expect(BuildErrorRedactionService.redact(message)).toBe(message);
  });

  it('handles a non-string input without throwing', () => {
    expect(BuildErrorRedactionService.redact(undefined)).toBe('');
    expect(BuildErrorRedactionService.redact(null)).toBe('');
  });
});
