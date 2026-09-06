import { afterEach, describe, expect, it } from 'vitest';
import { McpRegistryProvider } from '@core/mcp/mcp-registry-provider';
import { McpContextProxy } from '@core/plugin/context/mcp';
import { PluginHostRegistrations } from '@core/plugin/host/plugin-host-registrations';

/**
 * A relaunched guest boots again under the SAME PluginContext and registers the same MCP tools. The
 * context's mcp proxy only clears on the first registration of its lifetime, so the second boot was
 * refused with "already registered" and the restarted plugin ran without its tools. The host's
 * restart reset now clears the guest's tools before the guest re-registers them.
 */
describe('PluginHostRegistrations.resetForRestart', () => {
  const slug = 'restart-test-plugin';
  afterEach(() => McpRegistryProvider.get().unregisterOwner(slug));

  it('lets a relaunched guest register the same MCP tools again', () => {
    const registrations = new PluginHostRegistrations(slug, {} as any, async () => undefined, async () => undefined);
    const context: any = {
      hooks: { off: () => undefined },
      plugins: { off: () => undefined },
      mcp: McpContextProxy.createMcpProxy({ manifest: { slug } } as any),
    };
    const registration: any = {
      kind: 'mcp-tools',
      tools: [{ tool: `${slug}.things.list`, handlerId: 'h1', permission: 'things:read', inputSchema: { type: 'object', properties: {} } }],
    };

    registrations.apply(context, registration);
    registrations.resetForRestart(context);
    expect(() => registrations.apply(context, registration)).not.toThrow();
    expect(McpRegistryProvider.get().listTools().map((tool) => tool.tool)).toContain(`${slug}.things.list`);
  });
});
