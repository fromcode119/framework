import { describe, expect, it, vi } from 'vitest';
import { MediaContextProxy } from '@core/plugin/context/media';

const managerWith = (rows: Record<string, Record<string, unknown>>) => ({
  db: {
    findOne: vi.fn(async (_table: string, where: { id: unknown }) => rows[String(where.id)] ?? null),
    update: vi.fn(async () => ({})),
  },
}) as any;

describe('context.media.describe', () => {
  const security = { hasCapability: () => true, handleViolation: vi.fn(), handleRateLimit: vi.fn() } as any;

  it('sets a site file\'s description, trimmed, and nothing else', async () => {
    const manager = managerWith({ 7: { id: 7 } });
    const media = MediaContextProxy.createMediaProxy(manager, security);
    await expect(media.describe(7, { alt: '  SG451 Инструкции BG  ' })).resolves.toBe(true);
    expect(manager.db.update).toHaveBeenCalledWith(expect.anything(), { id: 7 }, { alt: 'SG451 Инструкции BG' });
  });

  it('changes nothing for an id this site does not hold, or for an empty description', async () => {
    const manager = managerWith({});
    const media = MediaContextProxy.createMediaProxy(manager, security);
    await expect(media.describe(99, { alt: 'x' })).resolves.toBe(false);
    await expect(MediaContextProxy.createMediaProxy(managerWith({ 1: { id: 1 } }), security).describe(1, { alt: '   ' })).resolves.toBe(false);
    expect(manager.db.update).not.toHaveBeenCalled();
  });

  it('writes nothing when the file is already so described', async () => {
    const manager = managerWith({ 3: { id: 3, alt: 'Manual' } });
    await expect(MediaContextProxy.createMediaProxy(manager, security).describe(3, { alt: 'Manual' })).resolves.toBe(true);
    expect(manager.db.update).not.toHaveBeenCalled();
  });

  it('is refused without the content capability', async () => {
    const refusing = { hasCapability: () => false, handleViolation: vi.fn(() => { throw new Error('denied'); }), handleRateLimit: vi.fn() } as any;
    await expect(MediaContextProxy.createMediaProxy(managerWith({ 1: { id: 1 } }), refusing).describe(1, { alt: 'x' })).rejects.toThrow('denied');
  });
});
