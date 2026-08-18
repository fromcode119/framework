/** A tool the MCP bridge can expose — carries a live handler, so it is a contract, not data. */
export interface IMcpToolDefinition {
  tool: string;
  title?: string;
  description?: string;
  readOnly?: boolean;
  /**
   * JSON Schema for the handler's `input`. OPTIONAL here only so tools written before this contract
   * still compile; a tool without it is never exposed by the registry, because a tool the model can
   * call but cannot call correctly is worse than an absent tool.
   */
  inputSchema?: Record<string, unknown>;
  /** Existing platform permission the caller's roles must satisfy, e.g. `content:write`. */
  permission?: string;
  metadata?: Record<string, unknown>;
  handler: (input?: Record<string, any>, context?: Record<string, any>) => Promise<any> | any;
}
