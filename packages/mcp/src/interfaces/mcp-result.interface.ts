/** The result of an MCP tool invocation. */
export interface IMcpResult {
  ok: boolean;
  output?: any;
  error?: string;
}
