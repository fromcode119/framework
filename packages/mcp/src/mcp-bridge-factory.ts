import { IMcpCall } from '@mcp/interfaces/mcp-call.interface';
import type { IMcpBridgeOptions } from '@mcp/interfaces/mcp-bridge-options.interface';
import type { IMcpToolDefinition } from '@mcp/interfaces/mcp-tool-definition.interface';
import type { IMcpBridge } from '@mcp/interfaces/mcp-bridge.interface';

/** Factory class for creating MCP bridge instances. */
export class McpBridgeFactory {
  static create(options: IMcpBridgeOptions = {}): IMcpBridge {
    const registry = new Map<string, IMcpToolDefinition>();
    for (const tool of options.tools || []) {
      if (!tool?.tool) continue;
      registry.set(String(tool.tool).trim(), tool);
    }

    return {
      listTools() {
        return Array.from(registry.values()).map((tool) => ({
          tool: tool.tool,
          description: tool.description,
          readOnly: tool.readOnly === true,
          metadata: tool.metadata && typeof tool.metadata === 'object'
            ? { ...tool.metadata }
            : undefined,
        }));
      },
      async call(request: IMcpCall) {
        const toolName = String(request?.tool || '').trim();
        if (!toolName) {
          return { ok: false, error: 'MCP tool is required.' };
        }

        const tool = registry.get(toolName);
        if (!tool) {
          return { ok: false, error: `MCP bridge is not configured for tool "${toolName}"` };
        }

        try {
          const output = await tool.handler(request?.input || {}, request?.context || {});
          return { ok: true, output };
        } catch (error: any) {
          return {
            ok: false,
            error: String(error?.message || error || `Tool "${toolName}" failed`),
          };
        }
      },
    };
  }
}
