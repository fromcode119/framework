/**
 * The wire shape `tools/list` returns. `permission` and `inputSchema` are REQUIRED: the registry
 * refuses to summarise a tool that lacks either, so anything a client can see, it can call correctly.
 */
export interface IMcpToolSummary {
  tool: string;
  title?: string;
  description?: string;
  readOnly: boolean;
  permission: string;
  inputSchema: Record<string, unknown>;
}
