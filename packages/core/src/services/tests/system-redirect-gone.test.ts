import { describe, expect, it, vi } from 'vitest';
import { SystemRedirectService } from '@core/services/system-redirect-service';
import { RedirectsContextProxy } from '@core/plugin/context/redirects';

const store = () => {
  const rows = new Map<string, Record<string, unknown>>();
  const db = {
    findOne: vi.fn(async (_t: string, where: Record<string, unknown>) => rows.get(String(where.from_path)) ?? null),
    insert: vi.fn(async (_t: string, data: Record<string, unknown>) => { const row = { id: rows.size + 1, ...data }; rows.set(String(data.from_path), row); return row; }),
    update: vi.fn(async () => null),
    find: vi.fn(async () => [...rows.values()]),
  };
  return { db: db as any, rows };
};

describe('a 410 rule — the page is gone for good', () => {
  it('is created without a target and answers gone', async () => {
    const { db } = store();
    const service = new SystemRedirectService(db);
    const created = await service.create({ fromPath: '/old-product', toPath: '/ignored', type: '410' });
    expect(created).toEqual(expect.objectContaining({ fromPath: '/old-product', toPath: '', type: '410' }));
    await expect(service.lookup('/old-product')).resolves.toEqual({ target: '', permanent: true, gone: true });
  });

  it('a 301 still needs a target, and an unknown type is a 301', async () => {
    const { db } = store();
    const service = new SystemRedirectService(db);
    await expect(service.create({ fromPath: '/a', type: '301' })).rejects.toThrow(/To path/);
    const row = await service.create({ fromPath: '/b', toPath: '/c', type: '999' });
    expect(row.type).toBe('301');
    await expect(service.lookup('/b')).resolves.toEqual({ target: '/c', permanent: true });
  });

  it('a plugin asks for one with gone: true', async () => {
    const { db, rows } = store();
    const security = { hasCapability: () => true, handleViolation: vi.fn(), handleRateLimit: vi.fn() } as any;
    const redirects = RedirectsContextProxy.createRedirectsProxy({ manifest: { slug: 'shop' } } as any, { db } as any, security);
    const result = await redirects.ensure([{ fromPath: '/p/ring', toPath: '', gone: true }]);
    expect(result.created).toBe(1);
    expect(rows.get('/p/ring')).toEqual(expect.objectContaining({ type: '410', to_path: '' }));
  });
});
