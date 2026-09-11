import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BuildService } from '@sources/packaging/build-service';

/**
 * The comparison that decides whether a stored credential is released.
 *
 * Its job is to be STRICT: case and a trailing slash or `.git` are noise git itself ignores, and
 * nothing beyond that is forgiven. Anything it cannot prove identical is a different repository,
 * because the cost of a false match is somebody else's host receiving a working token.
 */
describe('BuildService — releasing a stored token', () => {
  const STORED = 'https://github.com/fromcode119/plugin-forms.git';
  let service: any;

  const withStored = (gitUrl: string | null, gitSecret: string | null) => {
    service.buildSourceService = {
      getRawSourceBySlug: vi.fn(async () => (gitUrl === null ? null : { gitUrl, gitSecret })),
    };
  };

  beforeEach(() => {
    service = Object.create(BuildService.prototype);
    withStored(STORED, 'stored-token');
  });

  it('releases the token for the repository it was stored against', async () => {
    expect(await service.resolveStoredToken('forms', STORED)).toBe('stored-token');
  });

  it.each([
    ['a trailing slash', 'https://github.com/fromcode119/plugin-forms.git/'],
    ['no .git suffix', 'https://github.com/fromcode119/plugin-forms'],
    ['different case', 'HTTPS://GitHub.com/Fromcode119/Plugin-Forms.git'],
  ])('still recognises the same repository with %s', async (_label, requested) => {
    expect(await service.resolveStoredToken('forms', requested)).toBe('stored-token');
  });

  it.each([
    ['another host', 'https://attacker.example.com/fromcode119/plugin-forms.git'],
    ['another owner', 'https://github.com/someone-else/plugin-forms.git'],
    ['another repository', 'https://github.com/fromcode119/plugin-ecommerce.git'],
    ['the host as a prefix only', 'https://github.com/fromcode119/plugin-forms.git.attacker.com'],
    ['an empty URL', ''],
  ])('refuses to release it to %s', async (_label, requested) => {
    expect(await service.resolveStoredToken('forms', requested)).toBeUndefined();
  });

  it('has nothing to release for a source that stores no token', async () => {
    withStored(STORED, null);
    expect(await service.resolveStoredToken('forms', STORED)).toBeUndefined();
  });

  it('has nothing to release for a source that does not exist', async () => {
    withStored(null, null);
    expect(await service.resolveStoredToken('ghost', STORED)).toBeUndefined();
  });
});
