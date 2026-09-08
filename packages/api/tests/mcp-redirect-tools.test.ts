import { describe, expect, it, vi } from 'vitest';
import { McpRedirectTools } from '@api/controllers/mcp/tools/mcp-redirect-tools';

const buildDeps = (existing: any = null) => ({
  db: {
    find: vi.fn(async () => [{ id: 1, from_path: '/old', to_path: '/new', type: '301', enabled: 1, hit_count: 3, notes: '', created_at: 'T', updated_at: 'T' }]),
    findOne: vi.fn(async () => existing),
    insert: vi.fn(async (_t: string, data: any) => ({ id: 9, ...data })),
  },
  mediaManager: {} as any,
  hooks: { call: vi.fn(async () => ({})) },
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}) as any;

const tool = (deps: any, name: string) => McpRedirectTools.all(deps).find((t) => t.tool === name)!;

describe('McpRedirectTools — the framework-owned redirect store', () => {
  it('list is read-only system:view; create is system:manage', () => {
    const deps = buildDeps();
    expect(tool(deps, 'redirects.list').readOnly).toBe(true);
    expect(tool(deps, 'redirects.list').permission).toBe('system:view');
    expect(tool(deps, 'redirects.create').readOnly).toBe(false);
    expect(tool(deps, 'redirects.create').permission).toBe('system:manage');
  });

  it('list maps rows to the camelCase edge shape', async () => {
    const result: any = await tool(buildDeps(), 'redirects.list').handler({}, {});
    expect(result.items[0]).toMatchObject({ fromPath: '/old', toPath: '/new', type: '301', enabled: true, hitCount: 3 });
  });

  it('create delegates to the service with normalization and enabled=true', async () => {
    const deps = buildDeps();
    const result: any = await tool(deps, 'redirects.create').handler({ fromPath: 'old-page', toPath: '/new-page' }, {});
    expect(result.ok).toBe(true);
    const [, data] = deps.db.insert.mock.calls[0];
    expect(data.from_path).toBe('/old-page');
    expect(data.to_path).toBe('/new-page');
    expect(data.type).toBe('301');
  });

  it('surfaces the duplicate guard as a tool error', async () => {
    const deps = buildDeps({ id: 1, from_path: '/old-page' });
    await expect(tool(deps, 'redirects.create').handler({ fromPath: '/old-page', toPath: '/x' }, {})).rejects.toThrow(/already exists/);
  });

  it('refuses an invalid type', async () => {
    await expect(tool(buildDeps(), 'redirects.create').handler({ fromPath: '/a', toPath: '/b', type: '307' }, {})).rejects.toThrow(/301.*302/);
  });
});
