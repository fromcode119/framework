import { describe, expect, it, vi } from 'vitest';
import { MediaContextProxy } from '@core/plugin/context/media';

const allowed = { hasCapability: () => true, handleViolation: vi.fn(), handleRateLimit: vi.fn() } as any;

const managerWith = (rows: Record<string, Record<string, unknown>>, remove = vi.fn(async () => undefined)) => ({
  db: {
    findOne: vi.fn(async (_table: string, where: { id: unknown }) => rows[String(where.id)] ?? null),
    delete: vi.fn(async () => true),
  },
  integrations: { storage: { remove } },
}) as any;

describe('context.media.remove', () => {
  it('deletes a private file from the private space, then its row', async () => {
    const remove = vi.fn(async () => undefined);
    const manager = managerWith({ 4: { id: 4, path: 'cv-abc.pdf', visibility: 'private' } }, remove);

    await expect(MediaContextProxy.createMediaProxy(manager, allowed).remove(4)).resolves.toBe(true);

    expect(remove).toHaveBeenCalledWith('cv-abc.pdf', 'private');
    expect(manager.db.delete).toHaveBeenCalledWith(expect.anything(), { id: 4 });
  });

  it('removes a public file and its webp variant', async () => {
    const remove = vi.fn(async () => undefined);
    const manager = managerWith({ 2: { id: 2, path: 'a.png', optimized_path: 'a.webp', visibility: 'public' } }, remove);

    await MediaContextProxy.createMediaProxy(manager, allowed).remove(2);

    expect(remove).toHaveBeenCalledWith('a.png', 'public');
    expect(remove).toHaveBeenCalledWith('a.webp', 'public');
  });

  it('still deletes the row when the bytes are already gone', async () => {
    const missing = vi.fn(async () => { throw Object.assign(new Error('gone'), { code: 'ENOENT' }); });
    const manager = managerWith({ 3: { id: 3, path: 'x.pdf', visibility: 'private' } }, missing);

    await expect(MediaContextProxy.createMediaProxy(manager, allowed).remove(3)).resolves.toBe(true);
    expect(manager.db.delete).toHaveBeenCalled();
  });

  it('matches nothing for an id this site does not hold', async () => {
    const manager = managerWith({});
    await expect(MediaContextProxy.createMediaProxy(manager, allowed).remove(9)).resolves.toBe(false);
    expect(manager.db.delete).not.toHaveBeenCalled();
  });

  it('refuses a plugin without the content capability', async () => {
    const denied = { hasCapability: () => false, handleViolation: vi.fn(() => { throw new Error('denied'); }) } as any;
    await expect(MediaContextProxy.createMediaProxy(managerWith({ 1: { id: 1, path: 'p' } }), denied).remove(1)).rejects.toThrow('denied');
  });
});
