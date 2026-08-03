/** A tool the MCP bridge can expose — carries a live handler, so it is a contract, not data. */
export interface IMcpToolDefinition {
  tool: string;
  description?: string;
  readOnly?: boolean;
  metadata?: Record<string, unknown>;
  handler: (input?: Record<string, any>, context?: Record<string, any>) => Promise<any> | any;
}
