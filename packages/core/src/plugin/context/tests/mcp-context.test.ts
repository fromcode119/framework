import { describe, expect, it } from 'vitest';
import { McpContextProxy } from '@core/plugin/context/mcp';
import { McpRegistryProvider } from '@core/mcp/mcp-registry-provider';
import { McpSchema } from '@mcp/mcp-schema';

const plugin = (slug: string) => ({ manifest: { slug, name: slug, version: '1.0.0' } }) as any;

const tool = (name: string) => ({
  tool: name,
  permission: 'content:read',
  inputSchema: McpSchema.object({}),
  handler: () => ({ ok: true }),
});

describe('context.mcp.registerTools', () => {
  it('refuses a tool outside the plugin namespace', () => {
    const context = McpContextProxy.createMcpProxy(plugin('alpha'));
    expect(() => context.registerTools([tool('beta.things.list')])).toThrow(/alpha/);
  });

  it('refuses a reserved framework namespace', () => {
    const context = McpContextProxy.createMcpProxy(plugin('alpha'));
    expect(() => context.registerTools([tool('media.upload')])).toThrow(/reserved/i);
  });

  it('registers into the ONE shared registry under the plugin slug', () => {
    const context = McpContextProxy.createMcpProxy(plugin('testplug'));
    context.registerTools([tool('testplug.things.list')]);
    expect(McpRegistryProvider.get().resolve('testplug.things.list')).not.toBeNull();
  });

  it('a re-init REPLACES the previous registration instead of colliding with it', () => {
    McpContextProxy.createMcpProxy(plugin('replug')).registerTools([tool('replug.old.list')]);

    // Second lifetime — a disable/enable cycle re-runs onInit in-process.
    const secondLifetime = McpContextProxy.createMcpProxy(plugin('replug'));
    secondLifetime.registerTools([tool('replug.new.list')]);

    const registry = McpRegistryProvider.get();
    expect(registry.resolve('replug.old.list')).toBeNull();
    expect(registry.resolve('replug.new.list')).not.toBeNull();
  });

  it('two calls in the SAME lifetime accumulate rather than wipe each other', () => {
    const context = McpContextProxy.createMcpProxy(plugin('multi'));
    context.registerTools([tool('multi.a')]);
    context.registerTools([tool('multi.b')]);

    const registry = McpRegistryProvider.get();
    expect(registry.resolve('multi.a')).not.toBeNull();
    expect(registry.resolve('multi.b')).not.toBeNull();
  });
});
