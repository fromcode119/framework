import { describe, expect, it, vi } from 'vitest';
import { MediaContextProxy } from '@core/plugin/context/media';

const security = { hasCapability: () => true, handleViolation: vi.fn(), handleRateLimit: vi.fn() } as any;

/** A site's media rows as its tenant-scoped read sees them, and a storage that serves only the public space. */
const managerWith = (rows: Array<Record<string, unknown>>) => ({
  db: {
    find: vi.fn(async (_table: string, options: { where: { id: { in: string[] } } }) => rows.filter((row) => options.where.id.in.includes(String(row.id)))),
    findOne: vi.fn(),
  },
  integrations: { storage: { publicUrl: (path: string, visibility: string) => (visibility === 'public' ? `https://cdn.test/${path}` : null) } },
}) as any;

describe('context.media.publicUrls', () => {
  it('answers the address of many files in one read, keyed by id', async () => {
    const manager = managerWith([{ id: 1, path: 'a.png', visibility: 'public' }, { id: 2, path: 'b.mp3', visibility: 'public' }]);
    const media = MediaContextProxy.createMediaProxy(manager, security, 'demo');

    await expect(media.publicUrls([1, '2', 1, null, ''])).resolves.toEqual({ 1: 'https://cdn.test/a.png', 2: 'https://cdn.test/b.mp3' });
    expect(manager.db.find).toHaveBeenCalledTimes(1);
    expect(manager.db.findOne).not.toHaveBeenCalled();
  });

  it('leaves out an id this site does not hold and a private file', async () => {
    const media = MediaContextProxy.createMediaProxy(managerWith([{ id: 3, path: 'secret.pdf', visibility: 'private' }]), security, 'demo');
    await expect(media.publicUrls([3, 99])).resolves.toEqual({});
  });

  it('reads nothing for no ids', async () => {
    const manager = managerWith([]);
    await expect(MediaContextProxy.createMediaProxy(manager, security, 'demo').publicUrls([])).resolves.toEqual({});
    expect(manager.db.find).not.toHaveBeenCalled();
  });
});
