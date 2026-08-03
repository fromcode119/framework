import type { IMcpToolDefinition } from '@mcp/interfaces/mcp-tool-definition.interface';

/** Interface describing a live MCP bridge instance. */
export interface IMcpBridge {
  call: (request: import('@mcp/interfaces/mcp-call.interface').IMcpCall) => Promise<import('@mcp/interfaces/mcp-result.interface').IMcpResult>;
  listTools: () => Array<Pick<IMcpToolDefinition, 'tool' | 'description' | 'readOnly' | 'metadata'>>;
}
