import type { IMcpToolDefinition } from '@mcp/interfaces/mcp-tool-definition.interface';

/** Options for building an MCP bridge. */
export interface IMcpBridgeOptions {
  tools?: IMcpToolDefinition[];
}
