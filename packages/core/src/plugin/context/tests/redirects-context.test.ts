import { describe, expect, it, vi } from 'vitest';
import { RedirectsContextProxy } from '@core/plugin/context/redirects';

const plugin = { manifest: { slug: 'migrate', name: 'migrate', version: '1.0.0' } } as any;
const securityWith = (capabilities: string[]) => ({
  hasCapability: (name: string) => capabilities.includes(name),
  handleViolation: vi.fn((name: string) => { throw new Error(`Security Violation: missing ${name}`); }),
  handleRateLimit: vi.fn(),
}) as any;

/** An in-memory `_system_redirects`, keyed by from_path like the real unique index. */
const buildManager = (seed: Array<Record<string, unknown>> = []) => {
  const rows = new Map<string, Record<string, unknown>>(seed.map((row) => [String(row.from_path), row]));
  const db = {
    findOne: vi.fn(async (_table: string, where: Record<string, unknown>) => rows.get(String(where.from_path)) ?? null),
    insert: vi.fn(async (_table: string, data: Record<string, unknown>) => {
      const row = { id: rows.size + 1, ...data };
      rows.set(String(data.from_path), row);
      return row;
    }),
    update: vi.fn(),
  };
  return { manager: { db } as any, rows, db };
};

describe('context.redirects.ensure', () => {
  it('refuses a plugin without the content capability', async () => {
    const { manager, db } = buildManager();
    const redirects = RedirectsContextProxy.createRedirectsProxy(plugin, manager, securityWith(['database']));
    await expect(redirects.ensure([{ fromPath: '/a', toPath: '/b' }])).rejects.toThrow(/content/);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('adds new rules as 301 by default, 302 when not permanent, and credits the plugin', async () => {
    const { manager, rows } = buildManager();
    const redirects = RedirectsContextProxy.createRedirectsProxy(plugin, manager, securityWith(['content']));

    const result = await redirects.ensure([
      { fromPath: '/product/blue-shirt/', toPath: '/shop/blue-shirt' },
      { fromPath: '/2019/05/hello', toPath: '/blog/hello', permanent: false },
    ]);

    expect(result).toEqual({ created: 2, skipped: 0, failed: [] });
    expect(rows.get('/product/blue-shirt')).toEqual(expect.objectContaining({ to_path: '/shop/blue-shirt', type: '301', notes: 'Added by plugin "migrate"' }));
    expect(rows.get('/2019/05/hello')).toEqual(expect.objectContaining({ type: '302' }));
  });

  it('refuses a query-string From path instead of collapsing it onto the bare path', async () => {
    const { manager, rows } = buildManager();
    const redirects = RedirectsContextProxy.createRedirectsProxy(plugin, manager, securityWith(['content']));

    const result = await redirects.ensure([{ fromPath: '/?p=12', toPath: '/blog/hello' }]);

    expect(result.created).toBe(0);
    expect(result.failed[0].error).toMatch(/query string/);
    expect(rows.has('/')).toBe(false);
  });

  it('never overwrites an existing rule, so a second run adds nothing', async () => {
    const { manager, db } = buildManager([{ id: 1, from_path: '/old', to_path: '/operator-choice', type: '301', enabled: 1 }]);
    const redirects = RedirectsContextProxy.createRedirectsProxy(plugin, manager, securityWith(['content']));

    const result = await redirects.ensure([{ fromPath: '/old/', toPath: '/importer-choice' }]);

    expect(result).toEqual({ created: 0, skipped: 1, failed: [] });
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it('reports an invalid rule without stopping the rest', async () => {
    const { manager } = buildManager();
    const redirects = RedirectsContextProxy.createRedirectsProxy(plugin, manager, securityWith(['content']));

    const result = await redirects.ensure([
      { fromPath: '//evil.example', toPath: '/x' },
      { fromPath: '/fine', toPath: '' },
      { fromPath: '/ok', toPath: '/target' },
    ]);

    expect(result.created).toBe(1);
    expect(result.failed.map((entry) => entry.fromPath)).toEqual(['//evil.example', '/fine']);
  });

  it('refuses an oversized batch outright', async () => {
    const { manager, db } = buildManager();
    const redirects = RedirectsContextProxy.createRedirectsProxy(plugin, manager, securityWith(['content']));
    const rules = Array.from({ length: RedirectsContextProxy.MAX_RULES + 1 }, (_, index) => ({ fromPath: `/p${index}`, toPath: '/' }));
    await expect(redirects.ensure(rules)).rejects.toThrow(/at most 500/);
    expect(db.findOne).not.toHaveBeenCalled();
  });
});
