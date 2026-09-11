import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BuildSourceService } from '@plugin/src/services/build-source-service';

/**
 * The point of these tests is the WRITE path: a URL the transport allow-list refuses must never be
 * persisted. Storing it would be enough on its own — a later build re-reads the row and hands it to
 * `git`, so a rejection that only happens at build time would leave the hostile value sitting in the
 * database waiting for the next run.
 */
describe('BuildSourceService — source validation', () => {
  let db: any;
  let service: BuildSourceService;

  beforeEach(() => {
    db = {
      find: vi.fn(async () => []),
      findOne: vi.fn(async () => null),
      insert: vi.fn(async () => undefined),
      update: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
    };
    const secretService = { encrypt: (v: string) => v, decrypt: (v: string) => v, isEncrypted: () => true } as any;
    service = new BuildSourceService(db, secretService);
  });

  describe('createSource refuses a URL git could execute, and writes nothing', () => {
    const hostileUrls = [
      "ext::sh -c 'id'",
      'ext::git-upload-pack',
      'file:///etc/passwd',
      '--upload-pack=id',
      '-oProxyCommand=id',
      'ssh://git@example.com/o/r.git',
      'git@github.com:org/repo.git',
      '/srv/private/repo.git',
      'http://example.com/o/r.git',
    ];

    for (const gitUrl of hostileUrls) {
      it(`rejects ${gitUrl}`, async () => {
        await expect(service.createSource({ slug: 'demo', gitUrl, type: 'plugin' } as any)).rejects.toThrow();
        expect(db.insert).not.toHaveBeenCalled();
      });
    }
  });

  it('refuses an embedded credential rather than storing it in the URL column', async () => {
    await expect(service.createSource({
      slug: 'demo',
      gitUrl: 'https://user:ghp_secret@github.com/o/r.git',
      type: 'plugin',
    } as any)).rejects.toThrow(/credentials embedded/i);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('refuses a traversing slug — the slug becomes a clone directory segment', async () => {
    await expect(service.createSource({
      slug: '../../etc',
      gitUrl: 'https://github.com/o/r.git',
      type: 'plugin',
    } as any)).rejects.toThrow(/slug/i);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('refuses a branch that is not a valid git ref', async () => {
    await expect(service.createSource({
      slug: 'demo',
      branch: 'main;id',
      gitUrl: 'https://github.com/o/r.git',
      type: 'plugin',
    } as any)).rejects.toThrow(/branch/i);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('accepts and stores a plain https source', async () => {
    db.findOne = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 1, slug: 'demo', git_url: 'https://github.com/o/r.git', branch: 'main', type: 'plugin' });

    const created = await service.createSource({
      slug: 'demo',
      gitUrl: 'https://github.com/o/r.git',
      type: 'plugin',
    } as any);

    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(db.insert.mock.calls[0][1].git_url).toBe('https://github.com/o/r.git');
    expect(created.slug).toBe('demo');
  });

  it('refuses a hostile URL arriving through syncSources — the hook-bus entry point', async () => {
    await expect(service.syncSources([
      { slug: 'demo', gitUrl: "ext::sh -c 'id'", type: 'plugin' } as any,
    ])).rejects.toThrow();
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it('refuses a hostile URL on update, so an accepted source cannot be rewritten into one', async () => {
    db.findOne = vi.fn(async () => ({ id: 1, slug: 'demo', git_url: 'https://github.com/o/r.git' }));
    await expect(service.updateSource('demo', { gitUrl: 'file:///etc/passwd' } as any)).rejects.toThrow();
    expect(db.update).not.toHaveBeenCalled();
  });
});
