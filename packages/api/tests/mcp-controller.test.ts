import { describe, expect, it, vi } from 'vitest';
import { McpController } from '@api/controllers/mcp/mcp-controller';
import { McpToolCallService } from '@api/controllers/mcp/mcp-tool-call-service';
import { McpToolRegistry, McpSchema } from '@mcp/index';

const buildRegistry = () => {
  const registry = new McpToolRegistry();
  registry.register(McpToolRegistry.FRAMEWORK_OWNER, [
    {
      tool: 'content.list',
      permission: 'content:read',
      readOnly: true,
      inputSchema: McpSchema.object({ collection: McpSchema.string() }, ['collection']),
      handler: (input: any) => ({ collection: input.collection, items: [] }),
    },
  ]);
  return registry;
};

const res = () => {
  const r: any = { statusCode: 200, body: null };
  r.status = (c: number) => { r.statusCode = c; return r; };
  r.json = (b: any) => { r.body = b; return r; };
  return r;
};

const permissive = { hasPermission: async (_u: number, _p: string) => true };

describe('McpController.listTools', () => {
  it('hides a tool the token is not scoped for', async () => {
    const c = new McpController(new McpToolCallService(buildRegistry(), permissive, { record: vi.fn() }));
    const r = res();
    await c.listTools({ user: { id: '1', roles: ['admin'], mcpScopes: ['media.*'] } } as any, r);
    expect(r.body.tools).toEqual([]);
  });

  it('returns the tool when the scope matches', async () => {
    const c = new McpController(new McpToolCallService(buildRegistry(), permissive, { record: vi.fn() }));
    const r = res();
    await c.listTools({ user: { id: '1', roles: ['admin'], mcpScopes: ['content.*'] } } as any, r);
    expect(r.body.tools.map((t: any) => t.tool)).toEqual(['content.list']);
  });
});

describe('McpController.callTool', () => {
  it('runs the handler and returns its output', async () => {
    const c = new McpController(new McpToolCallService(buildRegistry(), permissive, { record: vi.fn() }));
    const r = res();
    await c.callTool({ user: { id: '1', roles: ['admin'] }, body: { tool: 'content.list', input: { collection: 'pages' } } } as any, r);
    expect(r.statusCode).toBe(200);
    expect(r.body).toEqual({ ok: true, output: { collection: 'pages', items: [] } });
  });

  it('404s an unknown tool', async () => {
    const c = new McpController(new McpToolCallService(buildRegistry(), permissive, { record: vi.fn() }));
    const r = res();
    await c.callTool({ user: { id: '1', roles: ['admin'] }, body: { tool: 'nope.nope' } } as any, r);
    expect(r.statusCode).toBe(404);
    expect(r.body.ok).toBe(false);
  });

  it('403s when the token scope does not cover the tool', async () => {
    const c = new McpController(new McpToolCallService(buildRegistry(), permissive, { record: vi.fn() }));
    const r = res();
    await c.callTool({ user: { id: '1', roles: ['admin'], mcpScopes: ['media.*'] }, body: { tool: 'content.list', input: { collection: 'pages' } } } as any, r);
    expect(r.statusCode).toBe(403);
  });

  it('403s when the role fails the tool permission even if the scope matches', async () => {
    const denying = { hasPermission: async (_u: number, _p: string) => false };
    const c = new McpController(new McpToolCallService(buildRegistry(), denying, { record: vi.fn() }));
    const r = res();
    await c.callTool({ user: { id: '1', roles: ['viewer'], mcpScopes: ['content.*'] }, body: { tool: 'content.list', input: { collection: 'pages' } } } as any, r);
    expect(r.statusCode).toBe(403);
  });

  it('400s when a required argument is missing', async () => {
    const c = new McpController(new McpToolCallService(buildRegistry(), permissive, { record: vi.fn() }));
    const r = res();
    await c.callTool({ user: { id: '1', roles: ['admin'] }, body: { tool: 'content.list', input: {} } } as any, r);
    expect(r.statusCode).toBe(400);
    expect(String(r.body.error)).toMatch(/collection/);
  });

  it('records an audit entry naming argument keys but never their values', async () => {
    const audit = { record: vi.fn() };
    const c = new McpController(new McpToolCallService(buildRegistry(), permissive, audit));
    const r = res();
    await c.callTool({ user: { id: '1', roles: ['admin'] }, body: { tool: 'content.list', input: { collection: 'pages' } } } as any, r);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      tool: 'content.list', userId: '1', argumentKeys: ['collection'], ok: true,
    }));
    expect(JSON.stringify(audit.record.mock.calls[0][0])).not.toContain('pages');
  });

  it('does not invoke the handler when dryRun is set', async () => {
    const registry = buildRegistry();
    const definition = registry.resolve('content.list')!;
    const spy = vi.spyOn(definition, 'handler');
    const c = new McpController(new McpToolCallService(registry, permissive, { record: vi.fn() }));
    const r = res();
    await c.callTool({ user: { id: '1', roles: ['admin'] }, body: { tool: 'content.list', input: { collection: 'pages' }, dryRun: true } } as any, r);
    expect(spy).not.toHaveBeenCalled();
    expect(r.body).toEqual({ ok: true, output: { dryRun: true, tool: 'content.list' } });
  });
});
