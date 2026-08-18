import { describe, expect, it, vi } from 'vitest';
import { McpCacheTools } from '../src/controllers/mcp/tools/mcp-cache-tools';

const buildDeps = () => ({
  db: {},
  mediaManager: {} as any,
  hooks: { call: vi.fn(async () => ({})) },
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
});

const purgeTool = (deps: any) => McpCacheTools.all(deps).find((t) => t.tool === 'cache.purge')!;

describe('McpCacheTools.cache.purge', () => {
  it('fires the framework purge hook so subscribed caches actually invalidate', async () => {
    const deps = buildDeps();
    await purgeTool(deps).handler({}, {});
    expect(deps.hooks.call).toHaveBeenCalledWith('system:cache:purge', expect.anything());
  });

  it('never claims a CDN purge it did not do — no credentials means cdn false with the reason', async () => {
    const deps = buildDeps();
    const result: any = await purgeTool(deps).handler({}, {});
    expect(result.framework).toBe(true);
    expect(result.cdn).toBe(false);
    expect(String(result.reason)).toMatch(/credential/i);
  });

  it('is declared with a schema and a permission so the registry lists it', () => {
    const tool = purgeTool(buildDeps());
    expect(tool.inputSchema).toBeTruthy();
    expect(tool.permission).toBe('system:manage');
    expect(tool.readOnly).toBe(false);
  });
});
