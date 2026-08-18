import { beforeEach, describe, expect, it } from 'vitest';
import { McpToolRegistry } from '../src/mcp-tool-registry';
import { McpSchema } from '../src/mcp-schema';
import type { IMcpToolDefinition } from '../src/interfaces/mcp-tool-definition.interface';

const tool = (name: string, extra: Partial<IMcpToolDefinition> = {}): IMcpToolDefinition => ({
  tool: name,
  permission: 'content:read',
  inputSchema: McpSchema.object({}),
  handler: () => ({ ok: true }),
  ...extra,
});

describe('McpToolRegistry', () => {
  let registry: McpToolRegistry;
  beforeEach(() => { registry = new McpToolRegistry(); });

  it('registers a plugin tool under the plugin namespace', () => {
    registry.register('alpha', [tool('alpha.products.list')]);
    expect(registry.listTools().map((t) => t.tool)).toEqual(['alpha.products.list']);
  });

  it('throws when a plugin registers outside its namespace', () => {
    expect(() => registry.register('alpha', [tool('beta.things.list')]))
      .toThrow(/alpha/);
  });

  it('throws when a plugin claims a reserved framework namespace', () => {
    expect(() => registry.register('alpha', [tool('content.update')]))
      .toThrow(/reserved/i);
  });

  it('lets the framework owner register reserved namespaces', () => {
    registry.register(McpToolRegistry.FRAMEWORK_OWNER, [tool('content.update')]);
    expect(registry.resolve('content.update')).not.toBeNull();
  });

  it('throws on a duplicate tool name instead of overwriting', () => {
    registry.register('alpha', [tool('alpha.products.list')]);
    expect(() => registry.register('alpha', [tool('alpha.products.list')]))
      .toThrow(/already registered/i);
  });

  it('hides a tool with no inputSchema but still resolves it', () => {
    registry.register('alpha', [tool('alpha.orders.list', { inputSchema: undefined })]);
    expect(registry.listTools()).toEqual([]);
    expect(registry.listSkipped()).toEqual(['alpha.orders.list']);
    expect(registry.resolve('alpha.orders.list')).not.toBeNull();
  });

  it('hides a tool with no permission', () => {
    registry.register('alpha', [tool('alpha.orders.get', { permission: undefined })]);
    expect(registry.listTools()).toEqual([]);
    expect(registry.listSkipped()).toEqual(['alpha.orders.get']);
  });

  it('defaults readOnly to false in the summary', () => {
    registry.register('alpha', [tool('alpha.products.update')]);
    expect(registry.listTools()[0].readOnly).toBe(false);
  });

  it('returns null for an unknown tool', () => {
    expect(registry.resolve('nope.nope')).toBeNull();
  });
});

describe('McpToolRegistry lazy sources', () => {
  const registry = () => new McpToolRegistry();

  it('lists tools a source yields for the given context', () => {
    const r = registry();
    r.registerSource('alpha', (ctx: any) => [tool(`alpha.orders.${ctx?.suffix || 'list'}`)]);
    expect(r.listTools({ suffix: 'get' }).map((t) => t.tool)).toEqual(['alpha.orders.get']);
  });

  it('resolves a source tool by name', () => {
    const r = registry();
    r.registerSource('alpha', () => [tool('alpha.orders.list')]);
    expect(r.resolve('alpha.orders.list')).not.toBeNull();
  });

  it('applies the namespace boundary to source output too', () => {
    const r = registry();
    r.registerSource('alpha', () => [tool('beta.things.list')]);
    expect(() => r.listTools()).toThrow(/alpha/);
  });

  it('lets a static tool win over a source tool of the same name', () => {
    const r = registry();
    r.register('alpha', [tool('alpha.orders.list', { title: 'static' })]);
    r.registerSource('alpha', () => [tool('alpha.orders.list', { title: 'lazy' })]);
    expect(r.listTools().filter((t) => t.tool === 'alpha.orders.list')).toHaveLength(1);
    expect(r.resolve('alpha.orders.list')?.title).toBe('static');
  });

  it('yields nothing rather than breaking the list when a source throws', () => {
    const r = registry();
    r.register(McpToolRegistry.FRAMEWORK_OWNER, [tool('content.list')]);
    r.registerSource('alpha', () => { throw new Error('runtime unavailable'); });
    expect(r.listTools().map((t) => t.tool)).toEqual(['content.list']);
  });

  it('refuses two sources for the same owner', () => {
    const r = registry();
    r.registerSource('alpha', () => []);
    expect(() => r.registerSource('alpha', () => [])).toThrow(/already registered/i);
  });
});

describe('McpToolRegistry.unregisterOwner', () => {
  const registry = () => new McpToolRegistry();

  it('removes only that owner\'s tools, source and skipped entries', () => {
    const r = registry();
    r.register(McpToolRegistry.FRAMEWORK_OWNER, [tool('content.list')]);
    r.register('alpha', [
      tool('alpha.orders.list'),
      tool('alpha.orders.export', { inputSchema: undefined }),
    ]);
    r.registerSource('alpha', () => [tool('alpha.orders.lazy')]);

    r.unregisterOwner('alpha');

    expect(r.resolve('alpha.orders.list')).toBeNull();
    expect(r.resolve('alpha.orders.lazy')).toBeNull();
    expect(r.listSkipped()).toEqual([]);
    expect(r.resolve('content.list')).not.toBeNull();
  });

  it('allows re-registration after unregistering — the plugin re-init path', () => {
    const r = registry();
    r.register('alpha', [tool('alpha.orders.list')]);
    r.unregisterOwner('alpha');
    r.register('alpha', [tool('alpha.orders.list')]);
    r.registerSource('alpha', () => []);
    expect(r.resolve('alpha.orders.list')).not.toBeNull();
  });
});
