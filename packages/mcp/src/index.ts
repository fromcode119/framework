export type McpCall = {
  tool: string;
  input?: Record<string, any>;
  context?: Record<string, any>;
};

export type McpResult = {
  ok: boolean;
  output?: any;
  error?: string;
};

export type McpToolDefinition = {
  tool: string;
  description?: string;
  readOnly?: boolean;
  handler: (input?: Record<string, any>, context?: Record<string, any>) => Promise<any> | any;
};

export type McpBridgeOptions = {
  tools?: McpToolDefinition[];
};

export interface McpBridge {
  call: (request: McpCall) => Promise<McpResult>;
  listTools: () => Array<Pick<McpToolDefinition, 'tool' | 'description' | 'readOnly'>>;
}

export function createMcpBridge(options: McpBridgeOptions = {}): McpBridge {
  const registry = new Map<string, McpToolDefinition>();
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
      }));
    },
    async call(request: McpCall) {
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
