/** Interface describing a live MCP bridge instance. */
export interface McpBridge {
  call: (request: import('./index.types').McpCall) => Promise<import('./index.types').McpResult>;
  listTools: () => Array<Pick<import('./index.types').McpToolDefinition, 'tool' | 'description' | 'readOnly' | 'metadata'>>;
}
