/** A single MCP tool invocation. */
export interface IMcpCall {
  tool: string;
  input?: Record<string, any>;
  context?: Record<string, any>;
}
