import { describe, expect, it, vi } from 'vitest';
import { SystemRedirectService } from '@core/services/system-redirect-service';

const rowsOf = (count: number) => Array.from({ length: count }, (_, i) => ({ id: i + 1, from_path: `/old/${i + 1}`, to_path: '/new', type: '301', enabled: 1 }));

describe('listing redirect rules', () => {
  it('pages over every rule and reports the true total, beyond the first thousand', async () => {
    const all = rowsOf(1300);
    const db = {
      find: vi.fn(async (_t: string, options: any) => all.slice(options.offset ?? 0, (options.offset ?? 0) + (options.limit ?? all.length))),
      count: vi.fn(async () => all.length),
    };
    const result = await new SystemRedirectService(db as any).list({ page: 26, limit: 50 });
    expect(result.total).toBe(1300);
    expect(result.redirects).toHaveLength(50);
    expect(result.redirects[0]).toEqual(expect.objectContaining({ fromPath: '/old/1251' }));
  });

  it('searches from, to and notes, and counts only the matches', async () => {
    const db = { find: vi.fn(async (_t: string, options: any) => (options.columns ? [{ id: 1 }, { id: 2 }] : [{ id: 1, from_path: '/brand/1/a.html', to_path: '/shop/collection/a' }])), count: vi.fn() };
    const result = await new SystemRedirectService(db as any).list({ search: ' /brand/ ' });
    expect(db.find.mock.calls[0][1].search).toEqual({ columns: ['from_path', 'to_path', 'notes'], value: '/brand/' });
    expect(result).toEqual(expect.objectContaining({ total: 2, page: 1, limit: 50 }));
    expect(db.count).not.toHaveBeenCalled();
  });
});
