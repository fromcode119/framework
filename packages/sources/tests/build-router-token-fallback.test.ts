import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SourcesRouter } from '@sources/http/sources-router';

/**
 * The edit dialog posts a BLANK token by design — a stored secret is never sent to the browser — so
 * a remote read made while editing has no credential of its own. Before this fallback, reading a
 * private repository's branches failed the moment it was opened for editing, and the field reported
 * "No branches could be read": a statement about the repository for what was really a statement
 * about the request.
 *
 * These tests pin the precedence, because getting it backwards is silent: a freshly typed token is
 * the operator REPLACING one, so it must win over what is stored.
 */
describe('SourcesRouter — which credential a remote read uses', () => {
  let buildService: any;
  let router: any;

  const STORED_URL = 'https://github.com/fromcode119/plugin-forms.git';
  const request = (body: Record<string, unknown>): any => ({ body });

  beforeEach(() => {
    buildService = {
      listBranches: vi.fn(async () => ['main']),
      inspectSource: vi.fn(async () => null),
      resolveStoredToken: vi.fn(async (slug: string, gitUrl: string) =>
        (slug === 'forms' && gitUrl === STORED_URL ? 'stored-token' : undefined)),
    };
    router = Object.create(SourcesRouter.prototype);
    router.buildService = buildService;
  });

  it('uses the stored token when the form posts a blank one for a known source', async () => {
    const token = await router.resolveRequestToken(request({ slug: 'forms', gitSecret: '' }), STORED_URL);

    expect(token).toBe('stored-token');
    expect(buildService.resolveStoredToken).toHaveBeenCalledWith('forms', STORED_URL);
  });

  it('prefers a freshly typed token, because typing one means replacing it', async () => {
    const token = await router.resolveRequestToken(request({ slug: 'forms', gitSecret: 'typed-token' }), STORED_URL);

    expect(token).toBe('typed-token');
    expect(buildService.resolveStoredToken).not.toHaveBeenCalled();
  });

  it('has no credential for a source that does not exist yet', async () => {
    const token = await router.resolveRequestToken(request({}), 'https://github.com/org/repo.git');

    expect(token).toBeUndefined();
    expect(buildService.resolveStoredToken).not.toHaveBeenCalled();
  });

  it('treats a whitespace-only token as no token, not as a replacement', async () => {
    const token = await router.resolveRequestToken(request({ slug: 'forms', gitSecret: '   ' }), STORED_URL);

    expect(token).toBe('stored-token');
  });

  /**
   * Slug and URL both come from the caller. Trusting them to agree would make this endpoint a way
   * to post a stored credential to a host of the caller's choosing — the secret the form refuses to
   * display, leaving the server by another door.
   */
  it('refuses to release a stored token to a repository it was not stored against', async () => {
    const token = await router.resolveRequestToken(
      request({ slug: 'forms', gitSecret: '' }),
      'https://attacker.example.com/collect.git',
    );

    expect(token).toBeUndefined();
  });
});
